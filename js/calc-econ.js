/* ============================================================
   ЭКОНОМИКА
   Мультивалютные капзатраты, режимы кормов и ФОТ.
   Все итоги в тыс. тенге.
   ============================================================ */

window.MTF = window.MTF || {};

/* ---------- Капитальные затраты ---------- */
MTF.calcCapex = function (p, items) {
  const rows = [];
  /* prep оставлен в аккумуляторе ради старых проектов: там могут лежать
     статьи с этой группой, и без ключа они дали бы NaN. В стоимость
     фермы группа не входит — подготовительный этап считается в prep.js
     и оплачивается участниками до кредита. */
  const groups = { prep: 0, build: 0, equip: 0, herd: 0 };

  items.forEach(it => {
    const k = MTF.rate(p, it.cur);
    let sum = 0;
    if (it.id === 'herd' && it.auto) {
      sum = p.herd.heiferPrice * MTF.rate(p, p.herd.heiferCurrency) * p.herd.startHeifers;
    } else if (it.unit === 'sum') {
      sum = it.value * k;
    } else if (it.unit === 'place') {
      sum = it.value * k * (p.capacity[it.places] || 0);
    } else if (it.unit === 'head') {
      sum = it.value * k * p.herd.startHeifers;
    } else if (it.unit === 'qty') {
      // value — цена за единицу в валюте статьи, не в тысячах
      sum = it.value * (it.qty || 0) * k / 1000;
    }
    if (sum > 0) {
      rows.push({ id: it.id, name: it.name, group: it.group, sum: sum,
        cur: it.id === 'herd' && it.auto ? p.herd.heiferCurrency : it.cur,
        native: it.id === 'herd' && it.auto ? p.herd.heiferPrice : it.value,
        qty: it.id === 'herd' && it.auto ? p.herd.startHeifers : it.qty,
        unit: it.unit });
      groups[it.group] += sum;
    }
  });

  const subtotal = groups.build + groups.equip + groups.herd;
  // резерв начисляется на строительство и оборудование; скот идёт по цене контракта
  const reserve = (groups.build + groups.equip) * MTF.capexReserve / 100;
  groups.build += reserve;

  return { rows: rows, groups: groups, reserve: reserve, total: subtotal + reserve };
};

/* ---------- ФОТ ---------- */
/* Блоки оплаты труда. Строка штата без поля block относится к блоку фермы
   (так читаются проекты, сохранённые до появления блоков). */
MTF.staffBlockIds = ['complex', 'farm', 'land'];
MTF.staffBlockDefaults = {
  complex: { name: 'АУП комплекса', scope: 'project', scale: false },
  farm:    { name: 'АУП фермы и производственный персонал', scope: 'farm', scale: null },
  land:    { name: 'Земельный фонд', scope: 'project', scale: false }
};

/* На сколько ферм делятся общие блоки */
MTF.staffDivisor = function (p) {
  const n = p.staff && p.staff.shareFarms;
  return n > 0 ? n : Math.max(1, (p.project && p.project.farmsCount) || 1);
};

/* Параметры блока с учётом значений по умолчанию */
MTF.staffBlockOf = function (p, id) {
  const own = (p.staff && p.staff.blocks && p.staff.blocks[id]) || {};
  return Object.assign({}, MTF.staffBlockDefaults[id], own);
};

/* ФОТ на одну ферму. blocks — разбивка по блокам для таблиц и документа.
   Проект откорма (type = feedlot) считается по прежней схеме без блоков. */
MTF.calcPayroll = function (p, staff, cows) {
  const S = p.staff;
  if (S.mode === 'lump') {
    return { net: S.lumpAnnual, gross: S.lumpAnnual, headcount: null, blocks: [] };
  }
  const taxK = 1 + MTF.payrollTaxRate / 100;

  if (p.project && p.project.type === 'feedlot') {
    let net = 0, hc = 0;
    staff.forEach(s => { net += s.count * s.salary * 12; hc += s.count; });
    let k = 1;
    if (S.scaleToHerd && S.baseCows > 0 && cows > 0) {
      k = Math.max(0.45, Math.min(1, cows / S.baseCows));
    }
    return { net: net * k, gross: net * k * taxK, headcount: Math.round(hc * k), blocks: [] };
  }

  const N = MTF.staffDivisor(p);
  const blocks = MTF.staffBlockIds.map(function (id) {
    const d = MTF.staffBlockOf(p, id);
    const rows = staff.filter(s => (s.block || 'farm') === id);
    let net0 = 0, hc0 = 0;
    rows.forEach(s => { net0 += s.count * s.salary * 12; hc0 += s.count; });
    const scaleOn = (d.scale === null || d.scale === undefined) ? !!S.scaleToHerd : !!d.scale;
    let k = 1;
    if (scaleOn && S.baseCows > 0 && cows > 0) k = Math.max(0.45, Math.min(1, cows / S.baseCows));
    const div = d.scope === 'project' ? N : 1;
    const netBlock = net0 * k;                 // весь блок
    return {
      id: id, name: d.name, scope: d.scope, scale: scaleOn, k: k, divisor: div,
      rows: rows.length, headcountFull: hc0 * k,
      netTotal: d.scope === 'project' ? netBlock : netBlock * N,     // на N ферм
      grossTotal: (d.scope === 'project' ? netBlock : netBlock * N) * taxK,
      net: netBlock / div,                     // на одну ферму
      gross: netBlock / div * taxK,
      headcount: hc0 * k / div
    };
  });
  let net = 0, gross = 0, hc = 0;
  blocks.forEach(b => { net += b.net; gross += b.gross; hc += b.headcount; });
  return { net: net, gross: gross, headcount: Math.round(hc), blocks: blocks, farms: N };
};

/* ---------- Корма ---------- */
MTF.calcFeed = function (p, y) {
  const F = p.feed;
  if (F.mode === 'lump') return { sum: F.lumpAnnual, ha: 0 };
  if (F.mode === 'own') {
    const ha = F.landMode === 'perHead'
      ? Math.round(y.cows * F.landHaPerCow)
      : F.landHa;
    return { sum: ha * F.landCostPerHa / 1000, ha: ha };
  }
  const d = 365;
  let s = 0;
  // доля сухостоя и родилки — по среднему составу за год (когорты), объём — по поголовью года
  const avgAll = (y.dryAvg || 0) + (y.penAvg || 0) + (y.milkingAvg || 0);
  const dryHead = avgAll > 0
    ? y.cows * ((y.dryAvg || 0) + (y.penAvg || 0)) / avgAll
    : (y.dry || 0) + (y.pen || 0);
  const milkHead = Math.max(0, y.cows - dryHead);
  s += milkHead * F.dmCow * d * F.dmPriceCow / 1000;
  s += dryHead * (F.dmDry || F.dmCow) * d * F.dmPriceCow / 1000;
  s += y.heifers * F.dmHeifer * d * F.dmPriceYoung / 1000;
  s += y.calves * F.dmCalf * d * F.dmPriceYoung / 1000;
  s += y.bulls * F.dmBull * d * F.dmPriceYoung / 1000;
  return { sum: s, ha: 0 };
};

/* ---------- Операционные расходы ---------- */
MTF.calcOpex = function (p, herdYears, staff, opexItems) {
  const inf = 1 + p.prices.costInflation / 100;

  return herdYears.map((y, i) => {
    const k = Math.pow(inf, i);
    const detail = {};

    const feed = MTF.calcFeed(p, y);
    detail['Корма'] = feed.sum * k;

    const pr = MTF.calcPayroll(p, staff, y.cows);
    detail['Фонд оплаты труда'] = pr.gross * k;

    opexItems.forEach(it => {
      let v = 0;
      if (it.base === 'head') v = it.value * y.total;
      else if (it.base === 'cow') v = it.value * y.cows;
      else if (it.base === 'young') v = it.value * (y.heifers + y.calves + y.bulls);
      else if (it.base === 'sum') v = it.value;
      else if (it.base === 'milk') v = it.value * y.milkLiters / 1000;
      if (v > 0) detail[it.name] = v * k;
    });

    const qHeads = (i === 0 ? p.herd.startHeifers : 0) + y.heifersPurchased;
    if (qHeads > 0 && p.production.quarantineDays > 0) {
      detail['Карантин завозного поголовья'] =
        qHeads * MTF.quarantineCostPerHead * (p.production.quarantineDays / 30) * k;
    }

    if (y.heifersPurchased > 0) {
      detail['Приобретение нетелей'] =
        y.heifersPurchased * p.herd.heiferPrice * MTF.rate(p, p.herd.heiferCurrency) * k;
    }

    detail['Земельный налог'] = MTF.taxes.landTax * k;

    const total = Object.values(detail).reduce((a, b) => a + b, 0);
    return { year: y.year, idx: i, detail: detail, total: total, feedHa: feed.ha, headcount: pr.headcount };
  });
};

/* ---------- Выручка ---------- */
MTF.calcRevenue = function (p, herdYears) {
  const inf = 1 + p.prices.priceInflation / 100;

  return herdYears.map((y, i) => {
    const k = Math.pow(inf, i);
    const detail = {};
    detail['Молоко'] = y.milkLiters * p.prices.milk * k / 1000;
    // Побочная продукция входит в выручку, только если так выбрано (prices.revenueScope).
    // Старые проекты без поля считаются полной выручкой, как раньше.
    if (p.prices.revenueScope !== 'milk') {
      if (y.calvesSold > 0) detail['Реализация телят'] = y.calvesSold * p.prices.calf * k;
      if (y.heifersSoldValue > 0) detail['Реализация тёлок'] = y.heifersSoldValue * k;
      if (y.cullSold > 0) detail['Выбракованные коровы'] = y.cullSold * p.prices.cullCow * k;
      if (y.surplusSold > 0)
        detail['Сверхремонтные нетели'] = y.surplusSold * p.herd.heiferPrice * MTF.rate(p, p.herd.heiferCurrency) *
          ((p.herd.surplusHeiferPct === undefined ? 85 : p.herd.surplusHeiferPct) / 100) * k;
      if (y.bullsSold > 0) detail['Реализация бычков'] = y.bullWeightKg * p.prices.bullKg * k / 1000;
    }

    const total = Object.values(detail).reduce((a, b) => a + b, 0);
    return { year: y.year, idx: i, detail: detail, total: total };
  });
};

/* ---------- Субсидии ---------- */
MTF.calcSubsidies = function (p, herdYears, capex, subsidies) {
  return herdYears.map((y, i) => {
    const yr = i + 1;
    const detail = {};

    subsidies.filter(s => s.enabled && yr >= s.yearFrom && yr <= s.yearTo).forEach(s => {
      let v = 0;
      if (s.type === 'per_liter') v = y.milkLiters * s.value / 1000;
      else if (s.type === 'per_head') {
        if (s.id === 'breeding_heifers') {
          const heads = (i === 0 ? p.herd.startHeifers : 0) + y.heifersPurchased;
          v = heads * s.value;
        } else v = y.cows * s.value;
      } else if (s.type === 'capex_pct') {
        const span = s.yearTo - s.yearFrom + 1;
        const base = s.base === 'all' ? capex.total - (capex.prepIncluded || 0) : (capex.groups[s.base] || 0);
        v = base * s.value / 100 / span;
      } else if (s.type === 'fixed_year') v = s.value;
      if (v > 0) detail[s.name] = v;
    });

    const total = Object.values(detail).reduce((a, b) => a + b, 0);
    return { year: y.year, idx: i, detail: detail, total: total };
  });
};

MTF.calcOperatorFee = function (p, revenue, ebitdaBefore) {
  const f = p.finance;
  return revenue.map((r, i) => {
    if (f.operatorFeeMode === 'revenue') return r.total * f.operatorFeeValue / 100;
    if (f.operatorFeeMode === 'fixed') return f.operatorFeeValue;
    if (f.operatorFeeMode === 'ebitda') return Math.max(0, ebitdaBefore[i] * f.operatorFeeValue / 100);
    return 0;
  });
};

/* ---------- P&L ---------- */
MTF.calcPnL = function (p, herdYears, capex, staff, opexItems, subsidies) {
  const rev = MTF.calcRevenue(p, herdYears);
  const opex = MTF.calcOpex(p, herdYears, staff, opexItems);
  const sub = MTF.calcSubsidies(p, herdYears, capex, subsidies);

  const before = rev.map((r, i) => r.total + sub[i].total - opex[i].total);
  const fee = MTF.calcOperatorFee(p, rev, before);
  const depr = (capex.groups.build + capex.groups.equip) / MTF.taxes.depreciationYears;

  return herdYears.map((y, i) => {
    const revenue = rev[i].total, subsidy = sub[i].total;
    const cost = opex[i].total + fee[i];
    const ebitda = revenue + subsidy - cost;
    return {
      year: y.year, idx: i,
      revenue: revenue, subsidy: subsidy,
      opex: opex[i].total, operatorFee: fee[i],
      ebitda: ebitda,
      margin: (revenue + subsidy) > 0 ? ebitda / (revenue + subsidy) * 100 : 0,
      depreciation: i === 0 ? 0 : depr,
      ebit: ebitda - (i === 0 ? 0 : depr),
      milkCost: y.milkLiters > 0 ? cost * 1000 / y.milkLiters : 0,
      feedHa: opex[i].feedHa,
      headcount: opex[i].headcount,
      revDetail: rev[i].detail, opexDetail: opex[i].detail, subDetail: sub[i].detail
    };
  });
};

/* Обслуживание стада в расчёте на одну фуражную корову в год
   (по статьям с кодом care_, при проектной мощности). */
MTF.careCostPerCow = function (p, res, items) {
  const list = (items || []).filter(function (it) { return String(it.id || '').indexOf('care_') === 0; });
  const y = res && res.herd && res.herd.length ? res.herd[res.herd.length - 1] : null;
  if (!y || !(y.cows > 0)) return { perCow: 0, count: list.length };
  let sum = 0;
  list.forEach(function (it) {
    if (it.base === 'cow') sum += it.value;
    else if (it.base === 'head') sum += it.value * y.total / y.cows;
    else if (it.base === 'young') sum += it.value * (y.heifers + y.calves + y.bulls) / y.cows;
    else if (it.base === 'milk') sum += it.value * y.milkLiters / 1000 / y.cows;
    else if (it.base === 'sum') sum += it.value / y.cows;
  });
  return { perCow: sum, count: list.length };
};
