/* ============================================================
   ДВИЖЕНИЕ СТАДА — помесячная модель
   Гибкое размещение молодняка, режимы задания удоя,
   докуп поголовья по годам.
   ============================================================ */

window.MTF = window.MTF || {};

/* Межотёльный период в днях */
MTF.calvingInterval = function (P) {
  return 365 * 100 / Math.max(1, P.calvingRate);
};

/* Доли групп в фуражном поголовье */
MTF.herdShares = function (P) {
  const interval = MTF.calvingInterval(P);
  const dry = Math.min(0.4, P.dryDays / interval);
  const pen = Math.min(0.15, (P.calvingPenDays || 0) / interval);
  return {
    dry: dry,
    pen: pen,
    milking: Math.max(0.45, 1 - dry - pen)
  };
};

/* Расчётная доля дойных в фуражном поголовье */
MTF.milkingShare = function (P) { return MTF.herdShares(P).milking; };

/* Приведение удоя к годовому на фуражную корову */
MTF.annualYield = function (P) {
  const share = MTF.milkingShare(P);
  if (P.yieldMode === 'lactation') {
    // введён удой за лактацию 305 дней на дойную корову
    return P.milkYield / 305 * share * 365;
  }
  if (P.yieldMode === 'daily') {
    // введён среднесуточный удой дойной коровы
    return P.milkYield * share * 365;
  }
  return P.milkYield; // уже годовой на фуражную
};

/* Выбраковка коров в году проекта (yearIdx с нуля), три фазы:
   первые cullRateFreeYears лет — 0%, затем cullRateStartYears лет — cullRateStart,
   далее установившаяся cullRate (стадо молодое, почти все коровы — первотёлки). */
MTF.cullRateAt = function (P, yearIdx) {
  const free = P.cullRateFreeYears || 0;
  if (yearIdx < free) return 0;
  const n = P.cullRateStartYears || 0;
  if (n > 0 && yearIdx < free + n && P.cullRateStart !== undefined && P.cullRateStart !== null) {
    return P.cullRateStart;
  }
  return P.cullRate;
};

/* График продажи лишних тёлок, приведённый к рабочему виду.
   Если график не задан, всё продаётся в возрасте продажи телят. */
MTF.salePlanOf = function (P) {
  const saleAge = Math.max(1, P.calfSaleAgeMo || 2);
  const raw = Array.isArray(P.salePlan) && P.salePlan.length
    ? P.salePlan : [{ age: saleAge, share: 100, price: 0 }];
  const rows = raw.map(function (r) {
    return {
      age: Math.max(saleAge, Math.min(29, Math.round(+r.age || saleAge))),
      share: Math.max(0, +r.share || 0),
      price: Math.max(0, +r.price || 0)
    };
  }).filter(function (r) { return r.share > 0; });
  if (!rows.length) rows.push({ age: saleAge, share: 100, price: 0 });
  const total = rows.reduce(function (a, r) { return a + r.share; }, 0);
  rows.forEach(function (r) { r.frac = r.share / total; });
  rows.sort(function (a, b) { return a.age - b.age; });
  return rows;
};

/* Деление фуражных коров на сухостой, родилку и дойных по когортам отёлов.
   Когорта — коровы, отелившиеся в одном месяце t0 (завоз нетелей, ввод своих тёлок).
   Следующий отёл когорты через межотёльный период, затем цикл повторяется.
   На конец месяца m, фаза = время с последнего отёла (в месяцах):
   родилка — отёл не более calvingPenDays дней назад;
   сухостой — до следующего отёла не более dryDays дней;
   остальные — дойные. Сумма групп равна числу коров. */
MTF.cohortGroups = function (P, cohorts, m) {
  const per = MTF.calvingInterval(P) / 30;
  let dry = 0, pen = 0, total = 0;
  cohorts.forEach(function (c) {
    total += c.n;
    const phase = ((m - c.t0) % per + per) % per;
    if (phase * 30 <= (P.calvingPenDays || 0)) pen += c.n;
    else if ((per - phase) * 30 <= P.dryDays) dry += c.n;
  });
  return { dry: dry, pen: pen, milking: total - dry - pen };
};

/* Деление по долям от межотёльного периода (одинаково для любого возраста стада).
   Нужно для оценки проектной мощности (target); в таблице стада — когорты. */
MTF.herdGroups = function (shares, cows) {
  const dry = cows * shares.dry;
  const pen = cows * shares.pen;
  return { dry: dry, pen: pen, milking: cows - dry - pen };
};

MTF.calcHerd = function (p) {
  const H = p.herd, P = p.production, C = p.capacity;
  const months = p.project.horizon * 12;
  const yieldYear = MTF.annualYield(P);
  const shares = MTF.herdShares(P);
  const mShare = shares.milking;
  // Проектная мощность ограничена и коровником, и родильно-сухостойным блоком.
  // Дойных не может быть больше, чем мест в коровнике.
  const target = Math.min(
    C.cowPlaces + C.dryPlaces,
    Math.round(C.cowPlaces / shares.milking),
    shares.dry + shares.pen > 0 ? Math.round(C.dryPlaces / (shares.dry + shares.pen)) : 1e9
  );

  let cows = 0;
  const cohorts = [];  // когорты отёлов: { t0 — месяц отёла, n — число коров }
  let firstLact = 0;   // коровы в первой лактации
  const pregHeifers = {};
  const heifers = new Array(32).fill(0);
  const bulls = new Array(32).fill(0);

  // Лишние тёлки, дожидающиеся продажи по графику: по одному массиву возрастов на каждую ступень
  const salePlan = MTF.salePlanOf(P);
  const keepRatio = (P.heiferKeepRatio || 130) / 100;
  const surp = salePlan.map(function () { return new Array(32).fill(0); });

  // График завоза
  const arrivals = {};
  const b1 = Math.round(H.startHeifers * H.firstBatchShare / 100);
  arrivals[1] = b1;
  const rest = H.startHeifers - b1;
  const nb = Math.max(1, H.batches - 1);
  for (let i = 0; i < nb; i++) {
    const m = 1 + H.batchInterval * (i + 1);
    arrivals[m] = (arrivals[m] || 0) + Math.round(rest / nb);
  }

  // Плановый докуп до проектной мощности
  let purchasedTotal = H.startHeifers;
  if (H.restockMode === 'to_capacity') {
    const gap = Math.max(0, target - H.startHeifers);
    const perYear = gap / Math.max(1, H.restockYears);
    for (let y = 1; y <= H.restockYears; y++) {
      const m = y * 12 + 1;
      arrivals[m] = (arrivals[m] || 0) + Math.round(perYear);
      purchasedTotal += Math.round(perYear);
    }
  }

  const years = [];
  let acc = newYear();

  function newYear() {
    return {
      milkLiters: 0, calvings: 0, calvesBorn: 0,
      calvesSoldM: 0, calvesSoldF: 0, cullSold: 0,
      bullsSold: 0, bullWeightKg: 0,
      heifersPurchased: 0, surplusSold: 0,
      heifersSold: 0, heifersSoldValue: 0,
      dryAcc: 0, penAcc: 0, milkingAcc: 0,
      dryPeak: 0, penPeak: 0, dryPenPeak: 0, milkingPeak: 0,
      warnings: []
    };
  }
  function warn(a, t) { if (!a.warnings.includes(t)) a.warnings.push(t); }

  for (let m = 1; m <= months; m++) {
    const yIdx = Math.floor((m - 1) / 12);
    const cullNow = MTF.cullRateAt(P, yIdx);

    if (arrivals[m]) {
      const q = Math.round((P.quarantineDays || 0) / 30);
      const at = m + Math.max(1, 9 - H.gestationOnArrival) + q;
      pregHeifers[at] = (pregHeifers[at] || 0) + arrivals[m];
      if (m > 12) acc.heifersPurchased += arrivals[m];
    }

    // Ежегодный докуп при ремонте покупкой
    if (P.remontMode !== 'own' && m > 12 && m % 12 === 1) {
      const gap = Math.max(0, target - cows);
      const need = Math.round(cows * cullNow / 100 + Math.min(gap, target * 0.25));
      if (need > 0) {
        const q = Math.round((P.quarantineDays || 0) / 30);
        const at = m + Math.max(1, 9 - H.gestationOnArrival) + q;
        pregHeifers[at] = (pregHeifers[at] || 0) + need;
        acc.heifersPurchased += need;
      }
    }

    if (pregHeifers[m]) {
      cows += pregHeifers[m]; firstLact += pregHeifers[m];
      cohorts.push({ t0: m, n: pregHeifers[m] });
      acc.calvings += pregHeifers[m]; delete pregHeifers[m];
    }
    // первотёлка переходит во взрослое стадо через межотёльный период
    const graduate = firstLact / (MTF.calvingInterval(P) / 30);
    firstLact = Math.max(0, firstLact - graduate);

    const calvings = cows * (P.calvingRate / 100) / 12;
    acc.calvings += calvings;

    const born = calvings * (1 - P.calfMortality / 100);
    acc.calvesBorn += born;
    const females = born * (P.heiferShare / 100);
    heifers[0] += females;
    bulls[0] += born - females;

    const culled = cows * (cullNow / 100) / 12;
    firstLact = Math.max(0, firstLact - firstLact * (cullNow / 100) / 12);
    if (cows > 0) { const kc = 1 - culled / cows; cohorts.forEach(function (c) { c.n *= kc; }); }
    cows -= culled;
    acc.cullSold += culled;

    for (let a = 31; a > 0; a--) {
      heifers[a] = heifers[a - 1] * (1 - P.heiferMortality / 100 / 12);
      bulls[a] = bulls[a - 1] * (1 - P.heiferMortality / 100 / 12);
    }
    heifers[0] = 0; bulls[0] = 0;

    // лишние тёлки стареют вместе с остальными
    surp.forEach(function (arr) {
      for (let a = 31; a > 0; a--) arr[a] = arr[a - 1] * (1 - P.heiferMortality / 100 / 12);
      arr[0] = 0;
    });

    const saleAge = Math.max(1, P.calfSaleAgeMo);

    // продажа ступеней графика, у которых наступил возраст
    salePlan.forEach(function (t, j) {
      if (t.age > saleAge && surp[j][t.age] > 0) {
        acc.heifersSold += surp[j][t.age];
        acc.heifersSoldValue += surp[j][t.age] * t.price;
        surp[j][t.age] = 0;
      }
    });

    if (P.remontMode === 'own') {
      // отбор на ремонт: пока стадо не вышло на мощность, остаются все тёлки;
      // после выхода остаётся нужное для замены, лишние идут по графику продажи
      const avail = heifers[saleAge];
      // Стадо считается вышедшим на мощность с допуском в полторы месячные выбраковки:
      // после ежемесячной выбраковки поголовье всегда чуть ниже цели, и жёсткий порог
      // (98% от цели) не срабатывал никогда — все тёлки копились до первого отёла.
      const monthlyCull = cows * (cullNow / 100) / 12;
      const atCapacity = cows >= target - monthlyCull * 1.5;
      const keep = atCapacity ? Math.min(avail, monthlyCull * keepRatio) : avail;
      heifers[saleAge] = keep;
      const surplus = Math.max(0, avail - keep);
      if (surplus > 0) {
        salePlan.forEach(function (t, j) {
          const part = surplus * t.frac;
          if (t.age <= saleAge) {
            acc.heifersSold += part;
            acc.heifersSoldValue += part * p.prices.calf;
          } else {
            surp[j][saleAge] += part;
          }
        });
      }
    } else {
      acc.calvesSoldF += heifers[saleAge];
      heifers[saleAge] = 0;
    }

    const fc = Math.min(31, P.firstCalvingMo);
    if (P.remontMode === 'own' && heifers[fc] > 0) {
      const room = Math.max(0, target - cows);
      const enter = Math.min(heifers[fc], Math.max(0, room));
      cows += enter; firstLact += enter;
      if (enter > 0) cohorts.push({ t0: m, n: enter });
      acc.calvings += enter;
      acc.surplusSold += heifers[fc] - enter;
      heifers[fc] = 0;
    }

    if (P.bullMode === 'sell_calf') {
      acc.calvesSoldM += bulls[saleAge];
      bulls[saleAge] = 0;
    } else {
      const fa = Math.min(31, P.fattenAgeMo);
      if (bulls[fa] > 0) {
        acc.bullsSold += bulls[fa];
        acc.bullWeightKg += bulls[fa] * P.fattenWeightKg;
        bulls[fa] = 0;
      }
    }

    const fcK = (P.firstCalfYield || 100) / 100;
    const effCows = (cows - firstLact) + firstLact * fcK;
    acc.milkLiters += effCows * yieldYear / 12;

    // ----- Контроль скотомест -----
    const sumArr = function (arr, from, to) {
      let t = 0; for (let a = from; a < (to === undefined ? arr.length : to); a++) t += arr[a]; return t;
    };
    const surpOld = surp.reduce(function (a, arr) { return a + sumArr(arr, saleAge + 1); }, 0);
    const surpCalf = surp.reduce(function (a, arr) { return a + sumArr(arr, 0, saleAge + 1); }, 0);
    const heiferTotal = heifers.slice(saleAge + 1).reduce((a, b) => a + b, 0) + surpOld;
    const calfTotal = heifers.slice(0, saleAge + 1).reduce((a, b) => a + b, 0) +
                      bulls.slice(0, saleAge + 1).reduce((a, b) => a + b, 0) + surpCalf;
    const bullTotal = bulls.slice(saleAge + 1).reduce((a, b) => a + b, 0);
    const grp = MTF.cohortGroups(P, cohorts, m);
    const dry = grp.dry, pen = grp.pen, milking = grp.milking;
    acc.dryAcc += dry; acc.penAcc += pen; acc.milkingAcc += milking;
    acc.dryPeak = Math.max(acc.dryPeak, dry);
    acc.penPeak = Math.max(acc.penPeak, pen);
    acc.dryPenPeak = Math.max(acc.dryPenPeak, dry + pen);
    acc.milkingPeak = Math.max(acc.milkingPeak, milking);

    // свободные места коровника, доступные под молодняк
    const freeCow = C.flexHousing ? Math.max(0, C.cowPlaces - milking) : 0;
    const freeDry = C.flexHousing ? Math.max(0, C.dryPlaces - dry - pen) : 0;
    let flexPool = freeCow + freeDry;

    function over(cur, cap, label, coef) {
      let excess = cur - cap * 1.02;
      if (excess <= 0) return;
      const used = Math.min(excess, flexPool / (coef || 1));
      flexPool -= used * (coef || 1);
      excess -= used;
      if (excess > 0.5) {
        warn(acc, label + ': ' + Math.round(cur) + ' при ' + Math.round(cap) + ' местах' +
          (C.flexHousing && flexPool <= 0 ? ' (свободные места коровника уже заняты)' : ''));
      }
    }

    if (milking > C.cowPlaces * 1.02) warn(acc, 'Дойные: ' + Math.round(milking) + ' при ' + C.cowPlaces + ' местах');
    if (dry + pen > C.dryPlaces * 1.02)
      warn(acc, 'Родильно-сухостойный блок: ' + Math.round(dry + pen) +
        ' (сухостой ' + Math.round(dry) + ' + родилка ' + Math.round(pen) + ') при ' + C.dryPlaces + ' местах');
    over(calfTotal, C.calfPlaces, 'Телята', 0.5);
    over(heiferTotal, C.heiferPlaces, 'Ремонтный молодняк', 1);
    over(bullTotal, C.bullPlaces, 'Бычки', 1);

    if (m % 12 === 0) {
      years.push({
        year: p.project.startYear + yIdx, idx: yIdx,
        cows: cows, milking: milking, dry: dry, pen: pen, firstLact: firstLact,
        // среднее за год и пик года (декабрь — в полях dry, pen, milking)
        dryAvg: acc.dryAcc / 12, penAvg: acc.penAcc / 12, milkingAvg: acc.milkingAcc / 12,
        dryPeak: acc.dryPeak, penPeak: acc.penPeak, dryPenPeak: acc.dryPenPeak, milkingPeak: acc.milkingPeak,
        calves: calfTotal, heifers: heiferTotal, bulls: bullTotal,
        total: cows + calfTotal + heiferTotal + bullTotal,
        milkLiters: acc.milkLiters,
        milkPerCow: cows > 0 ? acc.milkLiters / cows : 0,
        calvesSold: acc.calvesSoldM + acc.calvesSoldF,
        surplusSold: acc.surplusSold,
        heifersSold: acc.heifersSold,
        heifersSoldValue: acc.heifersSoldValue,
        cullRate: cullNow,
        cullSold: acc.cullSold,
        bullsSold: acc.bullsSold,
        bullWeightKg: acc.bullWeightKg,
        heifersPurchased: acc.heifersPurchased,
        flexUsed: C.flexHousing ? Math.max(0, (freeCow + freeDry) - flexPool) : 0,
        warnings: acc.warnings.slice(0, 6)
      });
      acc = newYear();
    }
  }

  years.meta = {
    target: target,
    yieldYear: yieldYear,
    milkingShare: mShare,
    dryShare: shares.dry,
    penShare: shares.pen,
    calvingInterval: MTF.calvingInterval(P),
    purchasedTotal: purchasedTotal
  };
  return years;
};
