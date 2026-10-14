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

console.log(fails ? '\nЕсть ошибки: ' + fails : '\nВсе проверки пройдены');
process.exit(fails ? 1 : 0);
