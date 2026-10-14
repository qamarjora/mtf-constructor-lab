/* Группы коров в таблице стада: сухостой, родилка, дойные.
   Запуск из корня репозитория: node tests/herdgroups.test.js
   Раздел 1 — неизменные величины: стадо, надой и число животных не зависят от того,
   как коровы делятся на группы (вариант А — меняется только классификация).
   Разделы 2–3 — классификация по когортам отёлов. */
const vm = require('vm'), fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'js');
const files = ['config.js', 'subsidies.js', 'calc-herd.js'];
function load() {
  const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
  files.forEach(f => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f }));
  return ctx.MTF;
}
const M = load();
const c = o => JSON.parse(JSON.stringify(o));
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails++; };
const near = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 1e-6 : tol);
const nearArr = (a, b, tol) => a.length === b.length && a.every((x, i) => near(x, b[i], tol));

/* Два проекта: значения по умолчанию и проект с меньшим стартовым стадом (330 нетелей, коровник 400 / блок 122) */
const dflt = c(M.defaults);
const lab = c(M.defaults);
lab.capacity = Object.assign(lab.capacity, { cowPlaces: 400, dryPlaces: 122, calfPlaces: 100, heiferPlaces: 193, bullPlaces: 0, flexHousing: true });
lab.herd = Object.assign(lab.herd, { startHeifers: 330, batches: 2, batchInterval: 6, firstBatchShare: 50,
  heiferPrice: 5, heiferCurrency: 'EUR', gestationOnArrival: 6, restockMode: 'none', restockYears: 3 });
lab.production = Object.assign(lab.production, { heiferShare: 85, salePlanMode: 'steps',
  salePlan: [{ age: 2, share: 33.4, price: 0 }, { age: 6, share: 33.3, price: 220 }, { age: 12, share: 33.3, price: 400 }] });

const snap = {
  dflt: {
    target: 474,
    cows:  [470, 425.1, 474, 474, 474, 474, 474, 474, 474, 474, 474, 474],
    milk:  [1796820.02, 3329010.8, 3359951.15, 3644985.38, 3645620.94, 3645841.58, 3645918.18, 3645944.78, 3645954.01, 3645957.21, 3645958.33, 3645958.71],
    total: [574.21, 682.15, 778.29, 776.82, 779.77, 779.77, 779.77, 779.77, 779.77, 779.77, 779.77, 779.77]
  },
  lab: {
    target: 475,
    cows:  [330, 298.47, 360.38, 433.23, 475, 475, 475, 475, 475, 475, 475, 475],
    milk:  [971004.33, 2316779.03, 2411538.89, 3055505.77, 3492625.21, 3631063.29, 3645809.11, 3650928.41, 3652705.68, 3653322.69, 3653536.9, 3653611.27],
    total: [415.74, 568.83, 713.82, 837.87, 951.96, 895.27, 831.59, 831.59, 831.59, 831.59, 831.59, 831.59]
  }
};

console.log('1. Стадо, надой и число животных не зависят от деления на группы');
[['по умолчанию', dflt, snap.dflt], ['проект 330 нетелей', lab, snap.lab]].forEach(function (x) {
  const h = M.calcHerd(c(x[1]));
  ok(h.meta.target === x[2].target, x[0] + ': мощность = ' + x[2].target);
  ok(nearArr(h.map(y => y.cows), x[2].cows, 0.01), x[0] + ': фуражные коровы по годам');
  ok(nearArr(h.map(y => y.milkLiters), x[2].milk, 0.01), x[0] + ': надой по годам');
  ok(nearArr(h.map(y => y.total), x[2].total, 0.01), x[0] + ': всего животных по годам');
});

console.log('2. Когорты: сухостой и родилка по датам отёлов (cohortGroups)');
const Pc = c(dflt.production);                         // межотёльный 468 дн. = 15,6 мес.
const per = M.calvingInterval(Pc) / 30;
const one = [{ t0: 0, n: 100 }];
const g = m => M.cohortGroups(Pc, one, m);
ok(g(0).pen === 100 && g(0).dry === 0 && g(0).milking === 0, 'в месяц отёла вся когорта в родилке');
ok(g(1).pen === 0 && g(1).dry === 0 && g(1).milking === 100, 'через месяц после отёла — дойные (30 дн. > 14 дн. родилки)');
ok(g(per - 2.2).dry === 0, 'за 66 дн. до отёла сухостоя ещё нет (60 дн.)');
ok(g(per - 1.9).dry === 100, 'за 57 дн. до отёла — сухостой');
ok(g(per).pen === 100 && g(per + 0.2).pen === 100, 'следующий отёл через межотёльный период — снова родилка');
ok([0, 1, 5, 12, 14, 15, 20, 31, 40].every(m => { const x = g(m); return near(x.dry + x.pen + x.milking, 100, 1e-9); }), 'сумма групп равна числу коров');
const two = [{ t0: 0, n: 100 }, { t0: 6, n: 50 }];
const x2 = M.cohortGroups(Pc, two, 6);
ok(x2.pen === 50 && x2.milking === 100, 'две когорты считаются отдельно');
ok(M.cohortGroups(Pc, [], 5).milking === 0, 'без когорт групп нет');

console.log('3. Группы в таблице стада (декабрь, среднее и пик года)');
[['по умолчанию', dflt], ['проект 330 нетелей', lab]].forEach(function (x) {
  const h = M.calcHerd(c(x[1]));
  ok(h.every(y => near(y.dry + y.pen + y.milking, y.cows, 1e-6)), x[0] + ': в декабре сухостой + родилка + дойные = фуражные коровы');
  ok(h.every(y => y.dry >= 0 && y.pen >= 0 && y.milking >= 0), x[0] + ': группы неотрицательны');
  ok(h.every(y => y.dryPenPeak + 1e-9 >= y.dry + y.pen && y.milkingPeak + 1e-9 >= y.milking), x[0] + ': пик года не меньше декабря');
  ok(h.every(y => y.dryAvg <= y.dryPeak + 1e-9 && y.penAvg <= y.penPeak + 1e-9 && y.milkingAvg <= y.milkingPeak + 1e-9), x[0] + ': среднее за год не больше пика');
});
const hl = M.calcHerd(c(lab));
ok(hl[0].dry === 0 && hl[0].pen === 0, 'проект 330 нетелей: в декабре 1-го года сухостоя и родилки нет (обе партии отелились 5 и 11 мес.)');
ok(near(hl[0].penPeak, 165, 1e-6), 'проект 330 нетелей: пик родилки в 1-м году = партия 165 коров в месяц отёла');
ok(hl[2].dry > 100, 'проект 330 нетелей: в декабре 3-го года партии вместе в сухостое (' + Math.round(hl[2].dry) + ')');
ok(hl[0].warnings.some(w => w.indexOf('Родильно-сухостойный') === 0), 'проект 330 нетелей: 165 коров в родилке при 122 местах — предупреждение в 1-м году')
const hd = M.calcHerd(c(dflt));
ok(hd[0].milkingPeak > 400 * 1.02 && hd[0].warnings.some(w => w.indexOf('Дойные') === 0), 'по умолчанию: 470 нетелей отелились разом — дойных больше 400 мест, есть предупреждение');
const sh0 = M.herdShares(dflt.production);
ok(near(sh0.dry, 60 / M.calvingInterval(dflt.production), 1e-12), 'доля сухостоя (для мощности) = дни сухостоя / межотёльный период');
ok(near(sh0.pen, 14 / M.calvingInterval(dflt.production), 1e-12), 'доля родилки (для мощности) = дни родилки / межотёльный период');

console.log('4. Сумма групп и нулевой сухостой в 1-й год (классификация на декабрь)');
const withSpread = (base, n) => { const q = c(base); q.production.calvingSpreadMo = n; return q; };
[0, 2, 3].forEach(function (n) {
  [['по умолчанию', dflt], ['проект 330 нетелей', lab]].forEach(function (x) {
    const h = M.calcHerd(withSpread(x[1], n));
    ok(h.every(y => near(y.dry + y.pen + y.milking, y.cows, 1e-6)), 'разброс ' + n + ', ' + x[0] + ': сухостой + родилка + дойные = коровы (все годы)');
  });
});
ok(M.calcHerd(c(lab))[0].dry === 0 && M.calcHerd(c(dflt))[0].dry === 0, 'в декабре 1-го года сухостоя нет: первые отёлы идут в 5–11 мес., до сухостоя ещё 13,6 мес. после отёла');
ok(M.calcHerd(c(dflt))[0].pen === 0 && M.calcHerd(c(lab))[0].pen === 0, 'и родилки в декабре 1-го года нет при разбросе 0 (отёл был в 5-м и 11-м месяцах)');

console.log('5. Пики по месяцам');
const h0 = M.calcHerd(c(lab));
ok(nearArr(h0.slice(0, 5).map(y => y.dryPenPeak), [165, 156, 152, 139, 147], 1), 'проект 330 нетелей: пик сухостой + родилка 2027–2031: 165, 156, 152, 139, 147');
ok(nearArr(h0.slice(0, 5).map(y => y.milking), [330, 298, 210, 396, 425], 1), 'проект 330 нетелей: дойные в декабре 2027–2031: 330, 298, 210, 396, 425');
ok(nearArr(h0.slice(0, 5).map(y => y.milkingPeak), [330, 327, 320, 397, 425], 1), 'проект 330 нетелей: пик дойных 2027–2031: 330, 327, 320, 397, 425');
ok(h0.every(y => y.flexPeak + 1e-9 >= y.flexUsed), 'пик гибких мест не меньше декабрьского');
ok(h0.every(y => y.heifersPeak + 1e-9 >= y.heifers && y.calvesPeak + 1e-9 >= y.calves), 'пики молодняка не меньше декабрьских');

console.log('6. Предупреждения года не усекаются');
const tight = c(lab);
Object.assign(tight.capacity, { cowPlaces: 100, dryPlaces: 20, calfPlaces: 10, heiferPlaces: 10, bullPlaces: 1 });
Object.assign(tight.production, { bullMode: 'fatten' });
const ht = M.calcHerd(tight);
const wy = ht.find(y => ['Дойные', 'Родильно-сухостойный блок', 'Телята', 'Ремонтный молодняк'].every(k => y.warnings.some(w => w.indexOf(k) === 0)));
ok(!!wy, 'в одном году есть сообщения о дойных, блоке, телятах и ремонтном молодняке одновременно');
ok(ht.some(y => y.warnings.length >= 4), 'в году больше трёх сообщений (прежнее усечение до 6 штук не мешает)');
ok(ht.every(y => y.warnings.every(w => /: пик \d+/.test(w) && /мес\. в году/.test(w))), 'каждое сообщение содержит пик и число месяцев');
ok(ht.every(y => new Set(y.warnings.map(w => w.split(':')[0])).size === y.warnings.length), 'одно сообщение на группу в год');

console.log('7. Разброс отёлов (production.calvingSpreadMo)');
ok(M.defaults.production.calvingSpreadMo === 0, 'по умолчанию разброс 0 мес.');
const noField = c(lab); delete noField.production.calvingSpreadMo;
const hN = M.calcHerd(noField), hS0 = M.calcHerd(withSpread(lab, 0)), hS1 = M.calcHerd(withSpread(lab, 1));
const grpEq = (a, b) => a.every((y, i) => ['dry', 'pen', 'milking', 'dryPenPeak', 'milkingPeak', 'dryPeak', 'penPeak'].every(k => near(y[k], b[i][k], 1e-9)));
ok(grpEq(hN, hS0) && grpEq(hS0, hS1), 'разброс 0, 1 и отсутствие поля дают одинаковые группы (прежнее поведение)');
[2, 3].forEach(function (n) {
  const hs = M.calcHerd(withSpread(lab, n));
  ok(hs.every((y, i) => near(y.cows, h0[i].cows, 1e-9) && near(y.milkLiters, h0[i].milkLiters, 1e-6) && near(y.total, h0[i].total, 1e-9)),
    'разброс ' + n + ': коровы, надой и число животных не меняются');
});
const d2 = M.calcHerd(withSpread(lab, 2))[0], d3 = M.calcHerd(withSpread(lab, 3))[0];
ok(near(d2.milking, 248, 1) && near(d2.pen, 83, 1) && d2.dry === 0, 'разброс 2: декабрь 2027 — дойные 248, родилка 83 (вторая партия делится на две половины)');
ok(near(d3.milking, 220, 1) && near(d3.pen, 55, 1) && near(d3.dry, 55, 1), 'разброс 3: декабрь 2027 — дойные 220, сухостой 55 (отёл ещё впереди), родилка 55');
const cs = []; M.addCohort(cs, 5, 90, 3);
ok(cs.length === 3 && cs.every((x, i) => x.t0 === 5 + i && near(x.n, 30, 1e-12)), 'addCohort: 3 равные части в месяцы 5, 6, 7');
const c0 = []; M.addCohort(c0, 5, 90, 0); M.addCohort(c0, 6, 10, 1); M.addCohort(c0, 7, 0, 3);
ok(c0.length === 2 && c0[0].n === 90 && c0[1].n === 10, 'addCohort: 0 и 1 — одна когорта; пустая партия не добавляется');
ok(M.cohortGroups(Pc, [{ t0: 10, n: 40 }], 9).dry === 40, 'когорта, у которой отёл ещё впереди, считается в сухостое');
const sumPeaks = M.calcHerd(withSpread(lab, 3));
ok(sumPeaks.every(y => y.dryPenPeak + 1e-9 >= y.dry + y.pen), 'разброс 3: пик года не меньше декабря');

console.log(fails ? '\nЕсть ошибки: ' + fails : '\nВсе проверки пройдены');
process.exit(fails ? 1 : 0);
