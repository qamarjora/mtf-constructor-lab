/* ============================================================
   ИНТЕРФЕЙС
   ============================================================ */

window.MTF = window.MTF || {};

MTF.fmt = {
  num: function (v, d) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return Number(v).toLocaleString('ru-RU', {
      minimumFractionDigits: d || 0, maximumFractionDigits: d || 0
    });
  },
  pct: function (v, d) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return Number(v).toLocaleString('ru-RU', {
      minimumFractionDigits: d === undefined ? 1 : d,
      maximumFractionDigits: d === undefined ? 1 : d
    }) + '%';
  },
  x: function (v) { return v === null || isNaN(v) ? '—' : v.toFixed(1) + 'x'; },

  /* Строка из MTF.subsidyImpact в готовый текст.
     good — стало ли лучше от господдержки, null если сравнивать нечего. */
  impact: function (r) {
    const one = v => v === null ? '—'
      : (r.unit === '%' ? MTF.fmt.pct(v, r.d) : MTF.fmt.num(v, r.d));
    let diff = '—';
    if (r.diff !== null) {
      const abs = Math.abs(r.diff);
      const body = r.diffUnit ? MTF.fmt.num(abs, r.d) + ' ' + r.diffUnit
        : (r.unit === '%' ? MTF.fmt.pct(abs, r.d) : MTF.fmt.num(abs, r.d));
      diff = (r.diff > 0 ? '+' : r.diff < 0 ? '−' : '') + body;
    }
    return {
      off: one(r.off), on: one(r.on), diff: diff,
      good: (r.diff === null || r.diff === 0) ? null : ((r.diff > 0) === (r.better === 'up'))
    };
  }
};

MTF.state = null;
MTF.scenarios = [];

// Запасные реализации на случай устаревшего config.js
if (!MTF.dispCur) MTF.dispCur = function () { return 'KZT'; };
if (!MTF.dispSign) MTF.dispSign = function () { return '₸'; };
if (!MTF.disp) MTF.disp = function (p, v) { return v; };

MTF.initState = function () {
  return {
    params: JSON.parse(JSON.stringify(MTF.defaults)),
    capexItems: JSON.parse(JSON.stringify(MTF.capexItems)),
    staff: JSON.parse(JSON.stringify(MTF.staff)),
    opexItems: JSON.parse(JSON.stringify(MTF.opexItems)),
    subsidies: JSON.parse(JSON.stringify(MTF.subsidies)),
    docSections: JSON.parse(JSON.stringify(MTF.docSections)),
    docMode: 'estimate',
    version: MTF.VERSION
  };
};

MTF.get = p => p.split('.').reduce((o, k) => o[k], MTF.state.params);
MTF.set = function (p, v) {
  const ks = p.split('.'), last = ks.pop();
  ks.reduce((a, k) => a[k], MTF.state.params)[last] = v;
};

function field(label, path, unit, type, options) {
  const v = MTF.get(path);
  if (type === 'select') {
    return '<div class="f wide"><label>' + label + '</label><select data-p="' + path + '">' +
      options.map(o => '<option value="' + o[0] + '"' + (o[0] == v ? ' selected' : '') + '>' + o[1] + '</option>').join('') +
      '</select></div>';
  }
  if (type === 'check') {
    return '<div class="f"><label>' + label + '</label>' +
      '<input type="checkbox" data-pc="' + path + '"' + (v ? ' checked' : '') + ' style="width:18px;height:18px">' +
      '<span class="u"></span></div>';
  }
  const t = type === 'text' ? 'text' : 'number';
  return '<div class="f"><label>' + label + '</label>' +
    '<input type="' + t + '" data-p="' + path + '" value="' + v + '" step="any">' +
    '<span class="u">' + (unit || '') + '</span></div>';
}

function curField(label, path, curPath) {
  const v = MTF.get(path), c = MTF.get(curPath);
  return '<div class="f"><label>' + label + '</label>' +
    '<input type="number" data-p="' + path + '" value="' + v + '" step="any" style="width:96px">' +
    '<select data-p="' + curPath + '" class="cursel">' +
    Object.keys(MTF.currencies).map(k =>
      '<option value="' + k + '"' + (k === c ? ' selected' : '') + '>' + MTF.currencies[k].sign + '</option>').join('') +
    '</select></div>';
}

/* ---------- Блоки интерфейса, вынесенные из вкладок ---------- */
function escHtml(v) {
  return String(v === null || v === undefined ? '' : v).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* Схема продажи лишних тёлок: выбор готовой схемы и таблица ступеней */
function salePlanBlock(P) {
  if (P.production.remontMode !== 'own') return '';
  const presets = MTF.salePlanPresets || {};
  const mode = P.production.salePlanMode || 'early';
  const saleAge = Math.max(1, P.production.calfSaleAgeMo || 2);
  const plan = Array.isArray(P.production.salePlan) ? P.production.salePlan : [];
  const total = plan.reduce(function (a, r) { return a + (+r.share || 0); }, 0);
  const rows = plan.map(function (r, i) {
    const atCalf = (+r.age || 0) <= saleAge;
    return '<tr><td><input type="number" data-spa="' + i + '" value="' + r.age + '" step="1" style="width:62px"></td>' +
      '<td><input type="number" data-sps="' + i + '" value="' + r.share + '" step="any" style="width:66px"></td>' +
      '<td>' + (atCalf
        ? '<span class="hint" style="margin:0">цена телёнка (' + MTF.fmt.num(P.prices.calf) + ')</span>'
        : '<input type="number" data-spp="' + i + '" value="' + r.price + '" step="any" style="width:84px">') + '</td>' +
      '<td><button class="del" data-spdel="' + i + '">×</button></td></tr>';
  }).join('');
  return '<h4>Продажа лишних тёлок</h4>' +
    '<div class="f wide"><label>Схема</label><select data-spmode>' +
    Object.keys(presets).map(function (k) {
      return '<option value="' + k + '"' + (k === mode ? ' selected' : '') + '>' + presets[k].name + '</option>';
    }).join('') + '</select></div>' +
    '<div class="tw"><table><thead><tr><th>Возраст, мес.</th><th>Доля, %</th><th>Цена, тыс. ₸</th><th></th></tr></thead><tbody>' +
    rows + '</tbody></table></div>' +
    '<button class="btn" id="addSaleRow" style="margin-top:8px">Добавить ступень</button>' +
    (Math.abs(total - 100) > 0.5 && plan.length
      ? '<div class="note warn" style="margin-top:8px">Доли дают ' + MTF.fmt.num(total, 1) + '%, при расчёте они приводятся к 100%.</div>' : '') +
    '<div class="hint">Продаются только тёлки сверх нужного для ремонта стада. Пока стадо не вышло на мощность, остаются все. ' +
    'До продажи тёлки занимают места молодняка и потребляют корма, поэтому чем позже продажа, тем больше нужно помещений.</div>';
}

/* Оплата труда тремя блоками: АУП комплекса, АУП фермы, земельный фонд */
function staffBlocksHtml(P, res) {
  const f = MTF.fmt, S = MTF.state;
  const N = MTF.staffDivisor(P);
  const cows = res && res.herd && res.herd.meta ? res.herd.meta.target : P.capacity.cowPlaces + P.capacity.dryPlaces;
  const pr = MTF.calcPayroll(P, S.staff, cows);
  const blockOpts = function (cur) {
    return MTF.staffBlockIds.map(function (b) {
      return '<option value="' + b + '"' + (b === cur ? ' selected' : '') + '>' + escHtml(MTF.staffBlockOf(P, b).name) + '</option>';
    }).join('');
  };
  const sections = pr.blocks.map(function (b) {
    const idx = S.staff.map(function (s, i) { return [s, i]; }).filter(function (x) { return (x[0].block || 'farm') === b.id; });
    const rows = idx.map(function (x) {
      const s = x[0], i = x[1];
      return '<tr><td><input type="text" data-stn="' + i + '" value="' + escHtml(s.name) + '" style="width:100%;text-align:left;font-family:var(--sans)"></td>' +
        '<td><select data-stb="' + i + '" style="max-width:150px">' + blockOpts(b.id) + '</select></td>' +
        '<td><input type="number" data-staff="' + i + '" data-fld="count" value="' + s.count + '" step="any" style="width:56px"></td>' +
        '<td><input type="number" data-staff="' + i + '" data-fld="salary" value="' + s.salary + '" step="any" style="width:76px"></td>' +
        '<td class="n">' + f.num(s.count * s.salary * 12, 1) + '</td>' +
        '<td><button class="del" data-delstaff="' + i + '">×</button></td></tr>';
    }).join('');
    const empty = idx.length === 0;
    const unfilled = !empty && b.netTotal === 0;
    return '<div style="margin:20px 0 4px;padding-top:14px;border-top:1px solid var(--line)">' +
      '<div class="f wide"><label><b>Блок</b></label><input type="text" data-blkn="' + b.id + '" value="' + escHtml(b.name) + '"></div>' +
      '<div class="f wide"><label>Как считается</label><select data-blks="' + b.id + '">' +
        '<option value="project"' + (b.scope === 'project' ? ' selected' : '') + '>на весь проект, делится на ' + N + ' ферм</option>' +
        '<option value="farm"' + (b.scope === 'farm' ? ' selected' : '') + '>на каждую ферму</option></select></div>' +
      '<div class="f"><label>Масштабировать под поголовье</label>' +
        '<input type="checkbox" data-blksc="' + b.id + '"' + (b.scale ? ' checked' : '') + ' style="width:18px;height:18px"><span class="u"></span></div>' +
      (empty ? '<div class="note warn">В блоке нет должностей.</div>' :
        '<div class="tw"><table><thead><tr><th>Должность</th><th>Блок</th><th>Кол-во</th><th>Оклад, т.₸</th><th>В год</th><th></th></tr></thead><tbody>' +
        rows +
        '<tr class="sub"><td>С начислениями ' + MTF.payrollTaxRate + '%: на проект (' + N + ' ферм)</td><td></td><td></td><td></td><td class="n">' + f.num(b.grossTotal, 1) + '</td><td></td></tr>' +
        '<tr class="tot"><td>С начислениями: на одну ферму</td><td></td><td></td><td></td><td class="n">' + f.num(b.gross, 1) + '</td><td></td></tr>' +
        '</tbody></table></div>') +
      (unfilled ? '<div class="note warn" style="margin-top:8px">Блок не заполнен: впишите количество и оклады, пока он ничего не стоит.</div>' : '') +
      '<div class="row" style="margin-top:10px;margin-bottom:0">' +
        '<button class="btn" data-addstaff="' + b.id + '">Добавить должность</button>' +
        (empty || b.id !== 'farm' ? '<button class="btn" data-addstd="' + b.id + '">Добавить типовые должности</button>' : '') +
      '</div></div>';
  }).join('');

  return sections +
    '<div class="tw" style="margin-top:18px"><table><thead><tr><th>Итого</th><th>Всего на проект</th><th>На одну ферму</th></tr></thead><tbody>' +
    pr.blocks.map(function (b) {
      return '<tr><td>' + escHtml(b.name) + '</td><td class="n">' + f.num(b.grossTotal, 1) + '</td><td class="n">' + f.num(b.gross, 1) + '</td></tr>';
    }).join('') +
    '<tr class="tot"><td>ФОТ с начислениями</td><td class="n">' + f.num(pr.gross * N, 1) + '</td><td class="n">' + f.num(pr.gross, 1) + '</td></tr>' +
    '</tbody></table></div>' +
    '<div class="f" style="margin-top:12px"><label>Делить общие блоки на</label>' +
      '<input type="number" data-p="staff.shareFarms" value="' + (P.staff.shareFarms || 0) + '" step="1"><span class="u">ферм</span></div>' +
    '<div class="hint" style="margin-top:0">Ноль означает «по количеству ферм» (сейчас ' + (P.project.farmsCount || 1) + '). ' +
      'Если считаете первую очередь одной фермой, поставьте 1: весь общий АУП ляжет на неё.</div>' +
    field('Расписание составлено на', 'staff.baseCows', 'гол') +
    '<div class="hint">Масштабирование уменьшает численность пропорционально фактическому стаду, но не ниже 45% штата. ' +
      'Общие блоки обычно не зависят от поголовья одной фермы, поэтому по умолчанию масштабируется только блок фермы. ' +
      'Должность можно перенести в другой блок выпадающим списком.</div>';
}

/* ---------- 1. Вводные ---------- */
MTF.renderInputs = function (res) {
  const P = MTF.state.params;
  const meta = res.herd.meta;

  let checks = '';
  if (res.checks.length) {
    checks = res.checks.map(c => '<div class="note warn">' + c + '</div>').join('');
  }

  return checks + '<div class="grid g2">' +

    '<div class="card"><h3>Проект</h3>' +
    field('Название', 'project.name', '', 'text') +
    field('Область', 'project.region', '', 'text') +
    field('Район', 'project.district', '', 'text') +
    field('Оператор', 'project.operator', '', 'text') +
    field('Количество ферм', 'project.farmsCount', 'ед') +
    field('Год старта', 'project.startYear', '') +
    field('Горизонт расчёта', 'project.horizon', 'лет') +
    '<h4>Курсы валют, ₸</h4>' +
    field('Евро', 'project.rateEUR', '€') +
    field('Доллар', 'project.rateUSD', '$') +
    field('Рубль', 'project.rateRUB', '₽') +
    '<div class="hint">Курсы применяются к статьям затрат, у которых выбрана валюта. Итоги везде в тысячах тенге.</div>' +
    '</div>' +

    '<div class="card"><h3>Ёмкость комплекса</h3>' +
    field('Коровник (дойные)', 'capacity.cowPlaces', 'мест') +
    field('Родильно-сухостойный', 'capacity.dryPlaces', 'мест') +
    field('Телятник', 'capacity.calfPlaces', 'мест') +
    field('Ремонтный молодняк', 'capacity.heiferPlaces', 'мест') +
    field('Откорм бычков', 'capacity.bullPlaces', 'мест') +
    field('Гибкое размещение', 'capacity.flexHousing', '', 'check') +
    '<div class="hint">Проектная мощность: <b>' + MTF.fmt.num(res.herd.meta.target) +
    '</b> фуражных коров, из них дойных <b>' +
    MTF.fmt.num(res.herd.meta.target * res.herd.meta.milkingShare) + '</b>.<br>' +
    'Мощность ограничена наименьшим из помещений — коровником или родильно-сухостойным блоком.<br>' +
    'Гибкое размещение разрешает ставить молодняк на свободные места коровника, ' +
    'пока стадо не вышло на проектную мощность.</div>' +
    '</div>' +

    '<div class="card"><h3>Стартовое стадо</h3>' +
    field('Нетелей на старте', 'herd.startHeifers', 'гол') +
    field('Партий завоза', 'herd.batches', 'шт') +
    field('Интервал между партиями', 'herd.batchInterval', 'мес') +
    field('Доля первой партии', 'herd.firstBatchShare', '%') +
    curField('Цена нетели (тыс.)', 'herd.heiferPrice', 'herd.heiferCurrency') +
    field('Стельность при завозе', 'herd.gestationOnArrival', 'мес') +
    field('Порода', 'herd.breed', '', 'text') +
    field('Источник', 'herd.source', '', 'select',
      [['Импорт', 'Импорт'], ['Казахстан', 'Казахстан'], ['Россия', 'Россия']]) +
    '<h4>Плановый докуп</h4>' +
    field('Режим', 'herd.restockMode', '', 'select',
      [['none', 'Без докупа'], ['to_capacity', 'Довести до мощности']]) +
    field('За сколько лет', 'herd.restockYears', 'лет') +
    '<div class="hint">Закуп нетелей в капзатратах считается автоматически: ' +
    MTF.fmt.num(P.herd.startHeifers * P.herd.heiferPrice * MTF.rate(P, P.herd.heiferCurrency)) + ' тыс. ₸</div>' +
    '</div>' +

    '<div class="card"><h3>Продуктивность и воспроизводство</h3>' +
    field('Способ задания удоя', 'production.yieldMode', '', 'select',
      [['year', 'На фуражную корову за год'], ['lactation', 'За лактацию 305 дней'], ['daily', 'Среднесуточный на дойную']]) +
    field('Значение удоя', 'production.milkYield',
      P.production.yieldMode === 'daily' ? 'л/сут' : 'л') +
    '<div class="hint">Расчётный годовой удой на фуражную корову: <b>' +
    MTF.fmt.num(meta.yieldYear) + ' л</b>. Межотёльный период ' +
    MTF.fmt.num(meta.calvingInterval) + ' дн.<br>Структура стада: дойные <b>' +
    MTF.fmt.pct(meta.milkingShare * 100, 0) + '</b>, сухостой <b>' +
    MTF.fmt.pct(meta.dryShare * 100, 0) + '</b>, родилка <b>' +
    MTF.fmt.pct(meta.penShare * 100, 0) + '</b>.</div>' +
    field('Выход телят на 100 коров', 'production.calvingRate', 'гол') +
    field('Выбраковка, установившаяся', 'production.cullRate', '%/год') +
    field('Лет без выбраковки (0 — нет)', 'production.cullRateFreeYears', 'лет') +
    field('Выбраковка в пониженный период', 'production.cullRateStart', '%/год') +
    field('Сколько лет пониженная, после безвыбраковочного периода (0 — нет)', 'production.cullRateStartYears', 'лет') +
    field('Падёж телят', 'production.calfMortality', '%') +
    field('Падёж молодняка', 'production.heiferMortality', '%') +
    field('Дней сухостоя', 'production.dryDays', 'дн') +
    field('Дней в родильном отделении', 'production.calvingPenDays', 'дн') +
    field('Карантин завозного поголовья', 'production.quarantineDays', 'дн') +
    field('Удой первотёлки', 'production.firstCalfYield', '% от взр.') +
    field('Разброс отёлов в партии', 'production.calvingSpreadMo', 'мес') +
    '<div class="hint" style="margin-top:-4px">Влияет только на показ групп и пики мест. Надой и деньги не меняются. ' +
      'Исключение: при кормах «покупные» меняется доля сухостоя в рационе.</div>' +
    field('Доля тёлочек в приплоде', 'production.heiferShare', '%') +
    field('Возраст первого отёла', 'production.firstCalvingMo', 'мес') +
    field('Возраст продажи телят', 'production.calfSaleAgeMo', 'мес') +
    field('Оставлять тёлок на ремонт', 'production.heiferKeepRatio', '% к норме') +
    '<h4>Сценарии</h4>' +
    field('Ремонт стада', 'production.remontMode', '', 'select',
      [['own', 'Свой молодняк'], ['purchase', 'Покупка нетелей'], ['outsource', 'Сторонняя площадка']]) +
    field('Бычки', 'production.bullMode', '', 'select',
      [['sell_calf', 'Продажа телятами'], ['rearing', 'Доращивание'], ['fatten', 'Полный откорм']]) +
    (P.production.bullMode !== 'sell_calf'
      ? field('Возраст сдачи бычков', 'production.fattenAgeMo', 'мес') +
        field('Живой вес при сдаче', 'production.fattenWeightKg', 'кг')
      : '') +
    salePlanBlock(P) +
    '</div>' +

    '<div class="card"><h3>Корма</h3>' +
    field('Режим расчёта', 'feed.mode', '', 'select',
      [['purchase', 'Покупные по нормам'], ['own', 'Своя кормовая база'], ['lump', 'Одной суммой в год']]) +
    (P.feed.mode === 'purchase' ?
      field('СВ на дойную корову', 'feed.dmCow', 'кг/сут') +
      field('СВ на сухостойную', 'feed.dmDry', 'кг/сут') +
      field('СВ на тёлку', 'feed.dmHeifer', 'кг/сут') +
      field('СВ на телёнка', 'feed.dmCalf', 'кг/сут') +
      (P.production.bullMode !== 'sell_calf' ? field('СВ на бычка', 'feed.dmBull', 'кг/сут') : '') +
      field('Цена рациона дойных', 'feed.dmPriceCow', '₸/кг') +
      field('Цена рациона молодняка', 'feed.dmPriceYoung', '₸/кг')
      : '') +
    (P.feed.mode === 'own' ?
      field('Способ задания площади', 'feed.landMode', '', 'select',
        [['perHead', 'Га на корову'], ['fixed', 'Фиксированная площадь']]) +
      (P.feed.landMode === 'perHead'
        ? field('Га на фуражную корову', 'feed.landHaPerCow', 'га')
        : field('Пашня под корма', 'feed.landHa', 'га')) +
      field('Себестоимость га', 'feed.landCostPerHa', '₸/га') +
      '<div class="hint">При режиме «га на корову» площадь пересчитывается вслед за поголовьем. ' +
      'Это защищает от ситуации, когда база засеяна под полное стадо, а коров вдвое меньше.</div>'
      : '') +
    (P.feed.mode === 'lump' ?
      field('Затраты на корма в год', 'feed.lumpAnnual', 'т.₸') +
      '<div class="hint">Сумма индексируется на рост затрат. Нормы и цены рациона не используются.</div>'
      : '') +
    '</div>' +

    '<div class="card"><h3>Цены реализации</h3>' +
    field('В выручку включать', 'prices.revenueScope', '', 'select',
      [['milk', 'Только молоко'], ['all', 'Молоко, телята, молодняк, выбраковка']]) +
    (P.prices.revenueScope === 'milk' ? '<div class="hint">Продажа телят, молодняка, нетелей и выбракованных коров в расчёт не входит; цены ниже на выручку не влияют.</div>' : '') +
    field('Молоко', 'prices.milk', '₸/л') +
    field('Телёнок', 'prices.calf', 'т.₸') +
    field('Выбракованная корова', 'prices.cullCow', 'т.₸') +
    field('Сверхремонтная нетель, % от цены закупа', 'herd.surplusHeiferPct', '%') +
    (P.production.bullMode !== 'sell_calf' ? field('Бычок, живой вес', 'prices.bullKg', '₸/кг') : '') +
    field('Рост цен реализации', 'prices.priceInflation', '%/год') +
    field('Рост затрат', 'prices.costInflation', '%/год') +
    '</div>' +

    '</div>';
};

/* ---------- 2. Стадо ---------- */
MTF.renderHerd = function (res) {
  const f = MTF.fmt, C = MTF.state.params.capacity;
  const last = res.herd[res.herd.length - 1];
  const peak = res.herd.reduce((a, y) => a.cows > y.cows ? a : y, res.herd[0]);
  const tgt = res.herd.meta.target;

  // cur — пик по месяцам (расчёт), dec — значение в декабре
  function bar(label, cur, cap, dec) {
    const pv = cap > 0 ? cur / cap * 100 : (cur > 0 ? 999 : 0);
    const cls = pv > 100 ? 'over' : pv > 90 ? 'near' : '';
    return '<div class="cap"><div class="top"><span>' + label + '</span><b>' +
      f.num(cur) + ' / ' + f.num(cap) + '</b></div>' +
      '<div class="bar"><i class="' + cls + '" style="width:' + Math.min(100, pv) + '%"></i></div>' +
      (dec === undefined ? '' : '<div class="hint" style="margin:2px 0 0">декабрь: ' + f.num(dec) + '</div>') + '</div>';
  }

  const warnYears = res.herd.filter(y => y.warnings.length);
  const warnHtml = warnYears.length
    ? '<div class="note warn"><b>Расчётные пики по месяцам выше проектных мест.</b> Это оценка модели, а не вывод о нехватке мест: ' +
      'партии нетелей считаются отелившимися синхронно. Срок можно растянуть полем «Разброс отёлов в партии» на вкладке «Вводные».' +
      '<details style="margin-top:6px"><summary>Подробности по годам (' + warnYears.length + ')</summary>' +
      warnYears.map(y => '<b>' + y.year + '</b>: ' + y.warnings.join('; ')).join('<br>') + '</details></div>'
    : '<div class="note ok">Расчётные пики по месяцам помещаются в проектную ёмкость на всём горизонте' +
      (C.flexHousing && res.herd.some(y => y.flexPeak > 0) ? ' с учётом гибкого размещения молодняка.' : '.') + '</div>';

  const rows = res.herd.map(y =>
    '<tr><td class="n">' + y.year + '</td>' +
    ['cows', 'milking', 'dry', 'pen'].map(k => '<td class="n">' + f.num(y[k]) + '</td>').join('') +
    '<td class="n">' + f.num(y.milkingPeak) + '</td>' +
    '<td class="n">' + f.num(y.dryPenPeak) + '</td>' +
    ['calves', 'heifers', 'bulls'].map(k => '<td class="n">' + f.num(y[k]) + '</td>').join('') +
    '<td class="n"><b>' + f.num(y.total) + '</b></td>' +
    '<td class="n">' + f.num(y.milkLiters / 1000) + '</td>' +
    '<td class="n">' + f.num(y.milkPerCow) + '</td>' +
    '<td class="n">' + f.num(y.calvesSold) + '</td>' +
    '<td class="n">' + f.num(y.heifersSold || 0) + '</td>' +
    '<td class="n">' + f.num(y.cullSold) + '</td>' +
    '<td class="n">' + f.num(y.heifersPurchased) + '</td>' +
    '<td class="n">' + f.num(y.flexUsed) + '</td>' +
    '<td class="n">' + f.num(y.flexPeak) + '</td></tr>').join('');

  return warnHtml +
    '<div class="grid g2"><div class="card"><h3>Контроль скотомест в год пика стада (' + peak.year + ')</h3>' +
    '<div class="hint" style="margin-top:0">Полоски — пик по месяцам (расчёт); под полоской значение в декабре.</div>' +
    bar('Дойные', peak.milkingPeak, C.cowPlaces, peak.milking) +
    bar('Сухостой + родилка', peak.dryPenPeak, C.dryPlaces, peak.dry + peak.pen) +
    bar('Телята', peak.calvesPeak, C.calfPlaces, peak.calves) +
    bar('Ремонтный молодняк', peak.heifersPeak, C.heiferPlaces, peak.heifers) +
    bar('Бычки на откорме', peak.bullsPeak, C.bullPlaces, peak.bulls) +
    '<div class="hint">' + (C.flexHousing
      ? 'Гибкое размещение включено: излишек молодняка занимает свободные места коровника, пока они есть.'
      : 'Гибкое размещение выключено — каждая группа считается строго по своим местам.') + '</div></div>' +

    '<div class="card"><h3>Баланс воспроизводства</h3><div class="kpis">' +
    '<div class="kpi"><div class="lbl">Фуражное на конец</div><div class="val">' + f.num(last.cows) + '</div></div>' +
    '<div class="kpi"><div class="lbl">Нужно нетелей в год</div><div class="val">' +
    f.num(last.cows * MTF.state.params.production.cullRate / 100) + '</div></div>' +
    '<div class="kpi"><div class="lbl">Валовой надой</div><div class="val">' +
    f.num(last.milkLiters / 1000) + '</div><div class="sub">тонн в год</div></div>' +
    '<div class="kpi"><div class="lbl">Общее поголовье</div><div class="val">' + f.num(last.total) + '</div></div>' +
    '</div><div class="hint">Удой на фуражную корову в расчёте: <b>' +
    f.num(res.herd.meta.yieldYear) + ' л/год</b>. Всего закуплено нетелей за период: <b>' +
    f.num(res.herd.reduce((a, y) => a + y.heifersPurchased, MTF.state.params.herd.startHeifers)) + '</b> гол.</div></div></div>' +

    '<div class="card" style="margin-top:14px"><h3>Движение поголовья по годам</h3><div class="tw"><table>' +
    '<thead><tr><th>Год</th><th>Фураж.</th><th>Дойные<br><small>декабрь</small></th><th>Сухост.<br><small>декабрь</small></th>' +
    '<th>Родилка<br><small>декабрь</small></th><th>Дойные<br><small>пик года</small></th><th>Сух.+род.<br><small>пик года</small></th>' +
    '<th>Телята</th><th>Молодн.</th><th>Бычки</th><th>Всего</th><th>Надой, т</th><th>л/фур.гол</th>' +
    '<th>Прод. бычков</th><th>Прод. тёлок</th><th>Выбрак.</th><th>Закуп нет.</th>' +
    '<th>Гибк. места<br><small>декабрь</small></th><th>Гибк. места<br><small>пик года</small></th></tr></thead><tbody>' +
    rows + '</tbody></table></div>' +
    '<div class="hint">«Пик года» — максимум по месяцам года (расчёт); остальные группы — на конец года (декабрь). ' +
    'Деление коров на дойных, сухостой и родилку идёт по датам отёлов партий.</div></div>';
};

/* ---------- 3. Экономика ---------- */
MTF.renderEcon = function (res) {
  const f = MTF.fmt, cap = res.capex, P = MTF.state.params;

  const gname = { build: 'Строительство', equip: 'Оборудование', herd: 'Поголовье' };
  const dcur = MTF.dispCur(P), dsign = MTF.dispSign(P);
  const dd = 2;   // капзатраты показываем без округления
  const dunit = dcur === 'KZT' ? 'тыс. ₸' : 'тыс. ' + dsign;

  const GN = { build: 'Строительство и монтаж',
               equip: 'Оборудование и техника', herd: 'Поголовье' };
  const GORDER = ['build', 'equip', 'herd'];

  function capexRow(it, i, gcur) {
    const row = cap.rows.find(r => r.id === it.id);
    const sum = row ? row.sum : 0;
    const isAuto = it.id === 'herd' && it.auto;
    const rateVal = isAuto ? P.herd.heiferPrice : it.value;
    const curVal = isAuto ? P.herd.heiferCurrency : it.cur;
    const gd = gcur === 'KZT' ? 1 : 2;
    return '<tr><td><input type="text" data-cxn="' + i + '" value="' + it.name +
        '" style="width:100%;text-align:left;font-family:var(--sans)"' + (isAuto ? ' disabled' : '') + '></td>' +
      '<td><select data-cxu="' + i + '"' + (isAuto ? ' disabled' : '') + '>' +
        [['sum', 'Сумма, тыс.'], ['qty', 'Цена × кол-во'], ['place', 'За место'], ['head', 'За голову']].map(u =>
        '<option value="' + u[0] + '"' + (u[0] === it.unit ? ' selected' : '') + '>' + u[1] + '</option>').join('') +
        '</select></td>' +
      '<td><input type="number" data-cxv="' + i + '" value="' + rateVal + '" step="any" style="width:96px"' +
        (isAuto ? ' disabled' : '') + '></td>' +
      '<td>' + (it.unit === 'qty'
        ? '<input type="number" data-cxq="' + i + '" value="' + (it.qty || 0) + '" step="any" style="width:68px">'
        : (isAuto ? '<span class="hint" style="margin:0">' + f.num(P.herd.startHeifers) + '</span>' : '—')) + '</td>' +
      '<td><select data-cxc="' + i + '"' + (isAuto ? ' disabled' : '') + ' class="cursel">' +
        Object.keys(MTF.currencies).map(c => '<option value="' + c + '"' +
        (c === curVal ? ' selected' : '') + '>' + MTF.currencies[c].sign + '</option>').join('') + '</select></td>' +
      '<td class="n">' + f.num(MTF.disp(P, sum, gcur), gd) + '</td>' +
      '<td><select data-cxg="' + i + '"' + (isAuto ? ' disabled' : '') + '>' +
        GORDER.map(g => '<option value="' + g + '"' + (g === it.group ? ' selected' : '') +
        '>' + GN[g] + '</option>').join('') + '</select></td>' +
      '<td>' + (isAuto ? '<span class="hint" style="margin:0">авто</span>' :
        '<button class="del" data-cxdel="' + i + '">×</button>') + '</td></tr>';
  }

  const capexCards = GORDER.map(g => {
    const idx = MTF.state.capexItems.map((it, i) => [it, i]).filter(x => x[0].group === g);
    if (!idx.length) return '';
    const gcur = MTF.groupCur(P, g), gsign = MTF.groupSign(P, g);
    const gd = gcur === 'KZT' ? 1 : 2;
    const groupSum = cap.groups[g] - (g === 'build' ? cap.reserve : 0);
    return '<div class="card" style="margin-bottom:14px"><h3>' + GN[g] + '</h3>' +
      '<div class="f wide" style="margin-bottom:12px"><label>Валюта отображения группы</label>' +
      '<select data-gcur="' + g + '">' + Object.keys(MTF.currencies).map(c =>
        '<option value="' + c + '"' + (c === gcur ? ' selected' : '') + '>' +
        MTF.currencies[c].name + ' ' + MTF.currencies[c].sign + '</option>').join('') + '</select></div>' +
      '<div class="tw"><table><thead><tr><th>Статья</th><th>Тип</th><th>Цена</th><th>Кол-во</th>' +
      '<th>Вал.</th><th>Итого, тыс. ' + gsign + '</th><th>Группа</th><th></th></tr></thead><tbody>' +
      idx.map(x => capexRow(x[0], x[1], gcur)).join('') +
      (g === 'build' && cap.reserve > 0
        ? '<tr class="sub"><td>Резерв ' + MTF.capexReserve + '% (стройка и оборудование)</td>' +
          '<td></td><td></td><td></td><td></td><td class="n">' +
          f.num(MTF.disp(P, cap.reserve, gcur), gd) + '</td><td></td><td></td></tr>' : '') +
      '<tr class="tot"><td>Итого по группе</td><td></td><td></td><td></td><td></td>' +
      '<td class="n">' + f.num(MTF.disp(P, cap.groups[g], gcur), gd) + '</td><td></td><td></td></tr>' +
      '</tbody></table></div>' +
      '<button class="btn" data-addcx="' + g + '" style="margin-top:10px">Добавить статью</button></div>';
  }).join('');

  const totCur = MTF.dispCur(P), totSign = MTF.dispSign(P);
  const td2 = totCur === 'KZT' ? 0 : 1;
  const summaryCard = '<div class="card" style="margin-bottom:14px"><h3>Свод по проекту</h3>' +
    '<div class="f wide" style="margin-bottom:12px"><label>Валюта сводного итога</label>' +
    '<select data-p="project.displayCurrency">' + Object.keys(MTF.currencies).map(c =>
      '<option value="' + c + '"' + (c === totCur ? ' selected' : '') + '>' +
      MTF.currencies[c].name + ' ' + MTF.currencies[c].sign + '</option>').join('') + '</select></div>' +
    '<div class="tw"><table><thead><tr><th>Группа затрат</th><th>В валюте закупа</th>' +
    '<th>Тыс. ₸</th><th>Тыс. ' + totSign + '</th><th>Доля</th></tr></thead><tbody>' +
    GORDER.filter(g => cap.groups[g] > 0).map(g => {
      const gc = MTF.groupCur(P, g);
      return '<tr><td>' + GN[g] + '</td>' +
        '<td class="n">' + f.num(MTF.disp(P, cap.groups[g], gc), gc === 'KZT' ? 0 : 1) +
        ' ' + MTF.groupSign(P, g) + '</td>' +
        '<td class="n">' + f.num(cap.groups[g]) + '</td>' +
        '<td class="n">' + f.num(MTF.disp(P, cap.groups[g], totCur), td2) + '</td>' +
        '<td class="n">' + f.pct(cap.groups[g] / cap.total * 100, 1) + '</td></tr>';
    }).join('') +
    '<tr class="tot"><td>Стоимость одной фермы</td><td></td>' +
    '<td class="n">' + f.num(cap.total) + '</td>' +
    '<td class="n">' + f.num(MTF.disp(P, cap.total, totCur), td2) + '</td><td class="n">100%</td></tr>' +
    '<tr class="sub"><td>Стоимость проекта, ' + P.project.farmsCount + ' ферм</td><td></td>' +
    '<td class="n">' + f.num(cap.total * P.project.farmsCount) + '</td>' +
    '<td class="n">' + f.num(MTF.disp(P, cap.total * P.project.farmsCount, totCur), td2) + '</td><td></td></tr>' +
    '<tr class="sub"><td>На одну фуражную корову</td><td></td>' +
    '<td class="n">' + f.num(cap.total / Math.max(1, res.herd.meta.target)) + '</td>' +
    '<td class="n">' + f.num(MTF.disp(P, cap.total / Math.max(1, res.herd.meta.target), totCur), td2) +
    '</td><td></td></tr>' +
    '</tbody></table></div>' +
    '<div class="hint">Каждая группа показана в своей валюте закупа. Расчёты внутри ведутся в тенге ' +
    'по курсам из вкладки «Вводные».</div></div>';

  const staffBlock = P.staff.mode === 'lump'
    ? field('ФОТ с начислениями в год', 'staff.lumpAnnual', 'т.₸') +
      '<div class="hint">Штатное расписание не используется. Сумма индексируется на рост затрат.</div>'
    : (MTF.isFeedlot && MTF.isFeedlot(P)) ? (function () {
        const rows = MTF.state.staff.map((s, i) =>
          '<tr><td><input type="text" data-stn="' + i + '" value="' + s.name + '" style="width:100%;text-align:left;font-family:var(--sans)"></td>' +
          '<td><input type="number" data-staff="' + i + '" data-fld="count" value="' + s.count + '" style="width:56px"></td>' +
          '<td><input type="number" data-staff="' + i + '" data-fld="salary" value="' + s.salary + '" style="width:76px"></td>' +
          '<td class="n">' + f.num(s.count * s.salary * 12, 1) + '</td>' +
          '<td><button class="del" data-delstaff="' + i + '">×</button></td></tr>').join('');
        const pr = MTF.calcPayroll(P, MTF.state.staff, P.capacity.cowPlaces + P.capacity.dryPlaces);
        return '<div class="tw"><table><thead><tr><th>Должность</th><th>Кол-во</th><th>Оклад, т.₸</th><th>В год</th><th></th></tr></thead><tbody>' +
          rows +
          '<tr class="tot"><td>ФОТ на руки</td><td></td><td></td><td class="n">' + f.num(pr.net, 1) + '</td><td></td></tr>' +
          '<tr class="sub"><td>С начислениями ' + MTF.payrollTaxRate + '%</td><td></td><td></td><td class="n">' + f.num(pr.gross, 1) + '</td><td></td></tr>' +
          '</tbody></table></div>' +
          '<button class="btn" id="addStaff" style="margin-top:10px">Добавить должность</button>' +
          field('Масштабировать под поголовье', 'staff.scaleToHerd', '', 'check') +
          field('Расписание составлено на', 'staff.baseCows', 'гол') +
          '<div class="hint">При включённом масштабировании численность уменьшается пропорционально фактическому стаду, но не ниже 45% штата.</div>';
      })()
    : staffBlocksHtml(P, res);

  const pnlRows = res.pnl.map(y =>
    '<tr><td class="n">' + y.year + '</td>' +
    '<td class="n">' + f.num(y.revenue, 1) + '</td>' +
    '<td class="n pos">' + f.num(y.subsidy, 1) + '</td>' +
    '<td class="n">' + f.num(y.opex, 1) + '</td>' +
    '<td class="n">' + f.num(y.operatorFee, 1) + '</td>' +
    '<td class="n ' + (y.ebitda < 0 ? 'neg' : '') + '"><b>' + f.num(y.ebitda, 1) + '</b></td>' +
    '<td class="n ' + (y.margin < 0 ? 'neg' : '') + '">' + f.pct(y.margin, 0) + '</td>' +
    '<td class="n">' + f.num(y.milkCost, 1) + '</td></tr>').join('');

  const yi = Math.min(4, res.pnl.length - 1), y5 = res.pnl[yi];
  const opexDetail = Object.entries(y5.opexDetail).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => '<tr><td>' + k + '</td><td class="n">' + f.num(v, 1) + '</td><td class="n">' +
      f.pct(v / y5.opex * 100, 1) + '</td></tr>').join('');

  const opexRows = MTF.state.opexItems.map((it, i) =>
    '<tr><td><input type="text" data-oxn="' + i + '" value="' + it.name + '" style="width:100%;text-align:left;font-family:var(--sans)"></td>' +
    '<td><select data-oxb="' + i + '">' +
      [['head', 'На голову'], ['cow', 'На корову'], ['young', 'На молодняк'], ['sum', 'Сумма'], ['milk', 'На литр']].map(b =>
      '<option value="' + b[0] + '"' + (b[0] === it.base ? ' selected' : '') + '>' + b[1] + '</option>').join('') + '</select></td>' +
    '<td><input type="number" data-oxv="' + i + '" value="' + it.value + '" step="any" style="width:82px"></td>' +
    '<td><button class="del" data-oxdel="' + i + '">×</button></td></tr>').join('');

  return summaryCard + capexCards +
    '<div class="grid g2" style="margin-top:14px">' +
    '<div class="card"><h3>Оплата труда</h3>' +
    field('Режим', 'staff.mode', '', 'select', [['detailed', 'Штатное расписание'], ['lump', 'Одной суммой']]) +
    staffBlock + '</div>' +

    '<div class="card"><h3>Прочие операционные расходы</h3><div class="tw"><table>' +
    '<thead><tr><th>Статья</th><th>База</th><th>Ставка</th><th></th></tr></thead><tbody>' + opexRows +
    '</tbody></table></div>' +
    '<div class="row" style="margin-top:10px;margin-bottom:0"><button class="btn" id="addOpex">Добавить статью</button>' +
    (MTF.isFeedlot && MTF.isFeedlot(P) ? '' : '<button class="btn" id="addCareStd">Вернуть стандартные статьи обслуживания</button>') + '</div>' +
    (MTF.isFeedlot && MTF.isFeedlot(P) ? '' : (function () {
      const care = MTF.careCostPerCow(P, res, MTF.state.opexItems);
      return care.count
        ? '<div class="note ok" style="margin-top:10px">Обслуживание стада: <b>' + f.num(care.perCow, 1) +
          ' тыс. ₸</b> на одну фуражную корову в год при проектной мощности (' + care.count + ' статей с кодом care_).</div>'
        : '<div class="note warn" style="margin-top:10px">Статей обслуживания стада нет. Кнопка добавит ветпрепараты, ' +
          'диагностику, семя и осеменение, уход за копытами и анализы.</div>';
    })()) +
    '<div class="hint">Ставки обслуживания стада заведены как ориентир и подлежат уточнению у зоотехника и ветеринара.</div></div>' +
    '</div>' +

    '<div class="card" style="margin-top:14px"><h3>Прогноз финансовых показателей</h3><div class="tw"><table>' +
    '<thead><tr><th>Год</th><th>Выручка</th><th>Субсидии</th><th>Затраты</th><th>Оператор</th>' +
    '<th>EBITDA</th><th>Маржа</th><th>Себест. л, ₸</th></tr></thead><tbody>' + pnlRows +
    '</tbody></table></div><div class="hint">Суммы в тыс. тенге.</div></div>' +

    '<div class="card" style="margin-top:14px"><h3>Структура затрат, ' + y5.year + ' год</h3><div class="tw"><table>' +
    '<thead><tr><th>Статья</th><th>Сумма, т.₸</th><th>Доля</th></tr></thead><tbody>' + opexDetail +
    '<tr class="tot"><td>Итого</td><td class="n">' + f.num(y5.opex, 1) + '</td><td class="n">100%</td></tr>' +
    '</tbody></table></div>' + (y5.feedHa ? '<div class="hint">Площадь кормовой базы в этот год: ' +
    f.num(y5.feedHa) + ' га.</div>' : '') + '</div>';
};

/* ---------- 4. Субсидии ---------- */
MTF.renderSubsidies = function (res) {
  const f = MTF.fmt;
  let head = res.conflicts.map(c => '<div class="note warn">' + c.text + '</div>').join('');
  const total = res.pnl.reduce((a, y) => a + y.subsidy, 0);
  head += '<div class="note ok">Включённые меры дают <b>' + f.num(total) +
    ' тыс. ₸</b> за весь горизонт.</div>';

  const rows = MTF.state.subsidies.map((s, i) =>
    '<div class="sub-row' + (s.enabled ? '' : ' off') + '">' +
    '<input type="checkbox" data-sub="' + i + '"' + (s.enabled ? ' checked' : '') + '>' +
    '<div><div class="nm">' + s.name + '<span class="tag ' + s.status + '">' +
    ({ check: 'проверить', confirmed: 'подтверждено', draft: 'черновик' })[s.status] + '</span></div>' +
    '<div class="meta">Условие: ' + (s.condition || '—') + '<br>Период: годы ' + s.yearFrom + '–' + s.yearTo + '</div>' +
    '<textarea class="cmt" rows="1" data-cmt="' + i + '" placeholder="Комментарий проверяющего">' + (s.comment || '') + '</textarea></div>' +
    '<div class="rate"><input type="number" data-subval="' + i + '" value="' + s.value + '" step="any">' +
    '<span style="font-size:11px;color:var(--ink-3)">' + s.unit + '</span>' +
    '<button class="del" data-subdel="' + i + '">×</button></div></div>').join('');

  const byYear = res.pnl.map(y =>
    '<tr><td class="n">' + y.year + '</td><td class="n pos">' + f.num(y.subsidy) + '</td>' +
    '<td class="n">' + f.pct(y.revenue > 0 ? y.subsidy / y.revenue * 100 : 0, 0) + '</td></tr>').join('');

  return head +
    '<div class="row"><button class="btn" id="addSub">Добавить меру поддержки</button>' +
    '<button class="btn" id="allOn">Включить все</button>' +
    '<button class="btn" id="allOff">Выключить все</button></div>' + rows +
    '<div class="card" style="margin-top:14px"><h3>Поступление субсидий по годам</h3><div class="tw"><table>' +
    '<thead><tr><th>Год</th><th>Субсидии, т.₸</th><th>% к выручке</th></tr></thead><tbody>' + byYear +
    '</tbody></table></div></div>';
};

/* ---------- 5. Финансирование ---------- */
MTF.renderFin = function (res) {
  const f = MTF.fmt, m = res.metrics, fd = res.funding, P = MTF.state.params;
  const kpi = (l, v, s, c) => '<div class="kpi ' + (c || '') + '"><div class="lbl">' + l + '</div>' +
    '<div class="val">' + v + '</div>' + (s ? '<div class="sub">' + s + '</div>' : '') + '</div>';

  const gap = res.cf.gapYear
    ? '<div class="note err"><b>Кассовый разрыв в ' + res.cf.gapYear + ' году.</b> Минимальный остаток ' +
      f.num(res.cf.minCash) + ' тыс. ₸.</div>'
    : '<div class="note ok">Кассовых разрывов нет. Минимальный остаток ' + f.num(res.cf.minCash) + ' тыс. ₸.' +
      (res.cf.wcPeak > 0 ? ' Привлечено оборотного кредита ' + f.num(res.cf.wcPeak) + ' тыс. ₸.' : '') + '</div>';

  const capHit = res.cf.capHit
    ? '<div class="note err"><b>Оборотного кредита не хватает.</b> Лимит ' + f.num(res.cf.wcCap) +
      ' тыс. ₸ исчерпан — дефицит нечем закрыть. Нужно больше собственных средств или пересмотр параметров.</div>' : '';
  const dscrBad = m.minDscr < 1.2 && isFinite(m.minDscr)
    ? '<div class="note warn">Минимальный DSCR ' + m.minDscr.toFixed(2) +
      '. Кредиторы обычно требуют не ниже 1,2.' +
      (isFinite(m.minDscrY2) && m.minDscrY2 >= 1.2
        ? ' Со второго года покрытие выходит на ' + m.minDscrY2.toFixed(2) +
          ' — просадка приходится на пусконаладочный год.'
        : '') + '</div>' : '';

  const debtRows = res.debt.map((d, i) =>
    '<tr><td class="n">' + d.year + '</td><td class="n">' + f.num(d.opening) + '</td>' +
    '<td class="n">' + f.num(d.interest) + '</td><td class="n">' + f.num(d.principal) + '</td>' +
    '<td class="n"><b>' + f.num(d.payment) + '</b></td><td class="n">' + f.num(d.closing) + '</td>' +
    '<td class="n">' + f.num(res.cf.rows[i].wcBalance) + '</td>' +
    '<td class="n ' + (m.dscr[i].value !== null && m.dscr[i].value < 1.2 ? 'neg' : '') + '">' +
    (m.dscr[i].value !== null ? m.dscr[i].value.toFixed(2) : '—') + '</td></tr>').join('');

  const cfRows = res.cf.rows.map(r =>
    '<tr><td class="n">' + r.year + '</td>' +
    '<td class="n ' + (r.operating < 0 ? 'neg' : '') + '">' + f.num(r.operating) + '</td>' +
    '<td class="n">' + f.num(r.invest) + '</td><td class="n">' + f.num(r.financing) + '</td>' +
    '<td class="n ' + (r.net < 0 ? 'neg' : '') + '">' + f.num(r.net) + '</td>' +
    '<td class="n ' + (r.cumulative < 0 ? 'neg' : 'pos') + '"><b>' + f.num(r.cumulative) + '</b></td></tr>').join('');

  const exitRows = m.exits.map(e =>
    '<tr><td class="n">' + e.year + '</td><td class="n">' + f.x(e.moic) + '</td>' +
    '<td class="n ' + (e.irr !== null && e.irr < 0 ? 'neg' : '') + '">' +
    (e.irr !== null ? f.pct(e.irr * 100) : '—') + '</td>' +
    '<td class="n">' + f.num(e.equityValue) + '</td></tr>').join('');

  const impact = (function () {
    const imp = MTF.subsidyImpact(res);
    const head = '<div class="card" style="margin-bottom:14px"><h3>Влияние господдержки</h3>';
    if (!imp) return head + '<div class="note">Все меры поддержки выключены — ' +
      'расчёт идёт в одном сценарии, сравнивать не с чем.</div></div>';
    return head + '<div class="kpis">' + imp.map(r => {
      const t = f.impact(r);
      return kpi(r.label + (r.unit && r.unit !== '%' ? ', ' + r.unit : ''), t.diff,
        'без ' + t.off + ' → с ' + t.on,
        t.good === null ? '' : (t.good ? 'good' : 'bad'));
    }).join('') + '</div>' +
      '<div class="hint">Сценарий без поддержки пересчитан целиком: сняты и субсидии ' +
      'в выручке, и снижение ставки по кредиту.</div></div>';
  })();

  const N = P.project.farmsCount, lastH = res.herd[res.herd.length - 1];

  const scen = MTF.scenarios.length
    ? '<div class="card" style="margin-top:14px"><h3>Сравнение сценариев</h3><div class="tw"><table>' +
      '<thead><tr><th>Сценарий</th><th>Стоимость</th><th>Своё участие</th><th>NPV</th><th>IRR</th>' +
      '<th>Окуп.</th><th>Мин. DSCR</th><th></th></tr></thead><tbody>' +
      MTF.scenarios.map((s, i) => '<tr><td>' + s.name + '</td><td class="n">' + f.num(s.capex) + '</td>' +
        '<td class="n">' + f.num(s.equity) + '</td><td class="n ' + (s.npv < 0 ? 'neg' : 'pos') + '">' + f.num(s.npv) + '</td>' +
        '<td class="n">' + (s.irr !== null ? f.pct(s.irr * 100) : '—') + '</td>' +
        '<td class="n">' + (s.pb ? s.pb.toFixed(1) : '—') + '</td>' +
        '<td class="n">' + (isFinite(s.dscr) ? s.dscr.toFixed(2) : '—') + '</td>' +
        '<td><button class="del" data-scdel="' + i + '">×</button></td></tr>').join('') +
      '<tr class="tot"><td>Текущий расчёт</td><td class="n">' + f.num(res.capex.total) + '</td>' +
      '<td class="n">' + f.num(fd.equity) + '</td><td class="n">' + f.num(m.npv) + '</td>' +
      '<td class="n">' + (m.irr !== null ? f.pct(m.irr * 100) : '—') + '</td>' +
      '<td class="n">' + (m.payback ? m.payback.toFixed(1) : '—') + '</td>' +
      '<td class="n">' + (isFinite(m.minDscr) ? m.minDscr.toFixed(2) : '—') + '</td><td></td></tr>' +
      '</tbody></table></div></div>'
    : '';

  return gap + capHit + dscrBad +
    '<div class="kpis" style="margin-bottom:14px">' +
    kpi('Стоимость проекта', f.num(res.capex.total), 'тыс. ₸') +
    kpi('Собственное участие', f.num(fd.equity), f.pct(fd.equityShare, 0)) +
    kpi('Лимит займа', f.num(fd.loanTotal), f.pct(fd.loanShare, 0)) +
    kpi('NPV', f.num(m.npv), 'при ставке ' + P.finance.wacc + '%', m.npv > 0 ? 'good' : 'bad') +
    kpi('IRR проекта', m.irr !== null ? f.pct(m.irr * 100) : '—', '',
      m.irr !== null && m.irr * 100 > P.finance.wacc ? 'good' : 'bad') +
    kpi('Окупаемость', m.payback ? m.payback.toFixed(1) : '—', 'лет') +
    kpi('Дисконт. окупаемость', m.discountedPayback ? m.discountedPayback.toFixed(1) : '—', 'лет') +
    kpi('Мин. DSCR', isFinite(m.minDscr) ? m.minDscr.toFixed(2) : '—', 'весь горизонт',
      m.minDscr >= 1.2 ? 'good' : 'bad') +
    kpi('Мин. DSCR со 2-го года', isFinite(m.minDscrY2) ? m.minDscrY2.toFixed(2) : '—',
      'без пусконаладки', m.minDscrY2 >= 1.2 ? 'good' : 'bad') +
    '</div>' +

    '<div class="hint" style="margin:-6px 0 14px">Второй показатель не учитывает ' +
    'первый год проекта: идут пусконаладка и наполнение стада, обслуживать долг ' +
    'уже нужно, а проектного удоя ещё нет. Кредиторы обычно смотрят на покрытие ' +
    'в рабочем режиме, но требование не ниже 1,2 формально относится ко всему сроку.</div>' +

    impact +

    '<div class="row"><button class="btn pri" id="saveScen">Сохранить как сценарий</button>' +
    (MTF.scenarios.length ? '<button class="btn" id="clearScen">Очистить сравнение</button>' : '') + '</div>' +

    '<div class="grid g2"><div class="card"><h3>Параметры финансирования</h3>' +
    field('Ставка вознаграждения', 'finance.rate', '%') +
    field('Срок займа', 'finance.termYears', 'лет') +
    field('Льготный период', 'finance.graceYears', 'лет') +
    field('Финансирование стройки', 'finance.financeShareBuild', '%') +
    field('Финансирование оборудования', 'finance.financeShareEquip', '%') +
    field('Финансирование поголовья', 'finance.financeShareHerd', '%') +
    field('Ставка дисконтирования', 'finance.wacc', '%') +
    '<h4>Оборотный кредит</h4>' +
    field('Подбирать автоматически', 'finance.wcAuto', '', 'check') +
    field('Лимит (0 = авто)', 'finance.wcCap', 'т.₸') +
    field('Ставка', 'finance.wcRate', '%') +
    '<h4>Вознаграждение оператора</h4>' +
    field('База', 'finance.operatorFeeMode', '', 'select',
      [['revenue', '% от выручки'], ['ebitda', '% от EBITDA'], ['fixed', 'Фикс в год, т.₸']]) +
    field('Значение', 'finance.operatorFeeValue', '') +
    '<h4>Распределение капзатрат</h4>' +
    '<div class="f"><label>По годам, % через запятую</label>' +
    '<input type="text" id="spread" value="' + (P.finance.capexSpread || []).join(', ') + '" style="width:126px"></div>' +
    '<div class="hint">Например «70, 30» означает 70% вложений в первый год и 30% во второй.</div>' +
    '</div>' +

    '<div class="card"><h3>Консолидация по проекту</h3><div class="tw"><table>' +
    '<thead><tr><th>Показатель</th><th>1 ферма</th><th>' + N + ' ферм</th></tr></thead><tbody>' +
    [['Стоимость проекта', res.capex.total], ['Собственное участие', fd.equity],
     ['Лимит займа', fd.loanTotal], ['NPV', m.npv],
     ['Валовой надой, т/год', lastH.milkLiters / 1000], ['Фуражное поголовье', lastH.cows]]
      .map(r => '<tr><td>' + r[0] + '</td><td class="n">' + f.num(r[1]) + '</td><td class="n">' +
        f.num(r[1] * N) + '</td></tr>').join('') +
    '</tbody></table></div></div></div>' +

    '<div class="card" style="margin-top:14px"><h3>График погашения</h3><div class="tw"><table>' +
    '<thead><tr><th>Год</th><th>Остаток на начало</th><th>Проценты</th><th>Основной долг</th>' +
    '<th>Платёж</th><th>Остаток на конец</th><th>Оборотный</th><th>DSCR</th></tr></thead><tbody>' +
    debtRows + '</tbody></table></div></div>' +

    '<div class="card" style="margin-top:14px"><h3>Движение денежных средств</h3><div class="tw"><table>' +
    '<thead><tr><th>Год</th><th>Операционный</th><th>Инвестиционный</th><th>Финансовый</th>' +
    '<th>Чистый</th><th>Накопленный</th></tr></thead><tbody>' + cfRows + '</tbody></table></div></div>' +

    '<div class="card" style="margin-top:14px"><h3>Доходность на вложения инвестора</h3><div class="tw"><table>' +
    '<thead><tr><th>Год выхода</th><th>MOIC</th><th>IRR на вложения</th><th>Стоимость доли, т.₸</th></tr></thead>' +
    '<tbody>' + exitRows + '</tbody></table></div></div>' + scen;
};

/* ---------- 6. Документ ---------- */
MTF.renderDocTab = function (res) {
  const mode = MTF.state.docMode || 'custom';
  const m = MTF.docModes.find(x => x.id === mode) || MTF.docModes[MTF.docModes.length - 1];
  const secs = MTF.renderDoc(MTF.state, res);
  const list = MTF.state.docSections.map((s, i) =>
    '<label><input type="checkbox" data-sec="' + i + '"' + (s.enabled ? ' checked' : '') + '> ' + s.title + '</label>').join('');
  const prev = MTF.docHtml(MTF.state, secs);

  return '<div class="row no-print">' +
    '<button class="btn pri" id="expWord">Скачать Word</button>' +
    '<button class="btn" id="expPdf">Печать / PDF</button>' +
    '<button class="btn" id="expCsv">Таблицы в CSV</button>' +
    '<button class="btn" id="editTpl">Править шаблоны</button></div>' +
    '<div class="doc-wrap"><div class="card doc-list no-print">' +
    '<h3>Вид документа</h3>' +
    '<div class="f wide" style="margin-bottom:6px"><select id="docMode" style="width:100%">' +
    MTF.docModes.map(x => '<option value="' + x.id + '"' + (x.id === mode ? ' selected' : '') +
      '>' + x.name + '</option>').join('') + '</select></div>' +
    '<div class="hint" style="margin:0 0 16px">' + m.hint + '</div>' +
    '<h3>Разделы</h3>' + list +
    '<div class="hint">Правка галочек переключает вид на «Свой набор разделов».</div></div>' +
    '<div class="doc-prev" id="docPrev">' + prev + '</div></div>';
};

/* ---------- Каркас ---------- */
MTF.tabs = [
  { id: 'inputs', name: 'Вводные' }, { id: 'herd', name: 'Стадо' },
  { id: 'econ', name: 'Экономика' }, { id: 'subs', name: 'Субсидии' },
  { id: 'fin', name: 'Финансирование' }, { id: 'doc', name: 'Документ' }
];
MTF.activeTab = 'inputs';

MTF.render = function () {
  try { MTF.renderInner(); }
  catch (e) {
    const m = document.getElementById('main');
    if (m) m.innerHTML = '<div class="card"><h3>Ошибка расчёта</h3>' +
      '<div class="note err"><b>' + (e && e.message ? e.message : e) + '</b></div>' +
      '<p style="font-size:13px;color:var(--ink-2)">Чаще всего помогает кнопка «Сбросить» в шапке — ' +
      'она очищает сохранённое состояние. Если не помогло, проверьте, что в репозиторий залиты ' +
      'все восемь файлов из папки <code>js/</code>.</p>' +
      '<button class="btn pri" onclick="MTF.hardReset()">Сбросить и перезагрузить</button></div>';
    const n = document.getElementById('nav');
    if (n && !n.innerHTML) n.innerHTML = MTF.tabs.map((t, i) =>
      '<button data-tab="' + t.id + '">' + t.name + '</button>').join('');
    console.error(e);
  }
};

MTF.hardReset = function () {
  try { sessionStorage.removeItem('mtf'); } catch (e) {}
  MTF.state = MTF.initState(); MTF.scenarios = [];
  MTF.activeTab = 'inputs'; MTF.render();
};

MTF.renderInner = function () {
  const res = MTF.runModel(MTF.state);
  MTF.lastResult = res;

  document.getElementById('nav').innerHTML = MTF.tabs.map((t, i) =>
    '<button data-tab="' + t.id + '" class="' + (t.id === MTF.activeTab ? 'on' : '') + '">' +
    '<span class="n">' + String(i + 1).padStart(2, '0') + '</span>' + t.name + '</button>').join('');

  const map = {
    inputs: MTF.renderInputs, herd: MTF.renderHerd, econ: MTF.renderEcon,
    subs: MTF.renderSubsidies, fin: MTF.renderFin, doc: MTF.renderDocTab
  };
  document.getElementById('main').innerHTML = '<div class="panel on">' + map[MTF.activeTab](res) + '</div>';
  MTF.bind();
};

/* ---------- События ---------- */
MTF.bind = function () {
  const S = MTF.state, upd = () => { MTF.save(); MTF.render(); };

  document.querySelectorAll('#nav button').forEach(b =>
    b.onclick = () => { MTF.activeTab = b.dataset.tab; MTF.render(); });

  document.querySelectorAll('[data-p]').forEach(el => el.onchange = () => {
    MTF.set(el.dataset.p, el.type === 'number' ? (parseFloat(el.value) || 0) : el.value); upd();
  });
  document.querySelectorAll('[data-pc]').forEach(el => el.onchange = () => {
    MTF.set(el.dataset.pc, el.checked); upd();
  });

  const bindArr = (sel, fn) => document.querySelectorAll(sel).forEach(el => el.onchange = () => { fn(el); upd(); });
  bindArr('[data-cxv]', el => {
    const it = S.capexItems[el.dataset.cxv];
    if (it.id === 'herd' && it.auto) MTF.state.params.herd.heiferPrice = parseFloat(el.value) || 0;
    else it.value = parseFloat(el.value) || 0;
  });
  bindArr('[data-cxq]', el => S.capexItems[el.dataset.cxq].qty = parseFloat(el.value) || 0);
  bindArr('[data-gcur]', el => {
    MTF.state.params.project.groupCurrency = MTF.state.params.project.groupCurrency || {};
    MTF.state.params.project.groupCurrency[el.dataset.gcur] = el.value;
  });
  bindArr('[data-cxq]', el => S.capexItems[el.dataset.cxq].qty = parseFloat(el.value) || 0);
  bindArr('[data-gcur]', el => {
    MTF.state.params.project.groupCurrency = MTF.state.params.project.groupCurrency || {};
    MTF.state.params.project.groupCurrency[el.dataset.gcur] = el.value;
  });
  bindArr('[data-cxn]', el => S.capexItems[el.dataset.cxn].name = el.value);
  bindArr('[data-cxg]', el => S.capexItems[el.dataset.cxg].group = el.value);
  bindArr('[data-cxu]', el => S.capexItems[el.dataset.cxu].unit = el.value);
  bindArr('[data-cxc]', el => {
    const it = S.capexItems[el.dataset.cxc];
    if (it.id === 'herd' && it.auto) MTF.state.params.herd.heiferCurrency = el.value;
    else it.cur = el.value;
  });
  bindArr('[data-oxv]', el => S.opexItems[el.dataset.oxv].value = parseFloat(el.value) || 0);
  bindArr('[data-oxn]', el => S.opexItems[el.dataset.oxn].name = el.value);
  bindArr('[data-oxb]', el => S.opexItems[el.dataset.oxb].base = el.value);
  bindArr('[data-stn]', el => S.staff[el.dataset.stn].name = el.value);
  bindArr('[data-staff]', el => S.staff[el.dataset.staff][el.dataset.fld] = parseFloat(el.value) || 0);

  // оплата труда тремя блоками
  const ensureBlk = id => {
    const sp = S.params.staff;
    sp.blocks = sp.blocks || {};
    sp.blocks[id] = Object.assign({}, MTF.staffBlockOf(S.params, id), sp.blocks[id] || {});
    return sp.blocks[id];
  };
  bindArr('[data-stb]', el => S.staff[el.dataset.stb].block = el.value);
  bindArr('[data-blkn]', el => ensureBlk(el.dataset.blkn).name = el.value);
  bindArr('[data-blks]', el => ensureBlk(el.dataset.blks).scope = el.value);
  bindArr('[data-blksc]', el => ensureBlk(el.dataset.blksc).scale = el.checked);
  document.querySelectorAll('[data-addstaff]').forEach(el => el.onclick = () => {
    const b = el.dataset.addstaff, n = prompt('Название должности');
    if (n) { S.staff.push({ id: 's' + Date.now(), block: b, name: n, count: 1, salary: b === 'farm' ? 400 : 0 }); upd(); }
  });
  document.querySelectorAll('[data-addstd]').forEach(el => el.onclick = () => {
    const b = el.dataset.addstd;
    (MTF.staffStandard[b] || []).forEach(r => {
      if (!S.staff.some(x => x.id === r.id)) S.staff.push(Object.assign({ block: b }, r));
    });
    upd();
  });

  // график продажи лишних тёлок
  const planOf = () => { S.params.production.salePlan = S.params.production.salePlan || []; return S.params.production.salePlan; };
  document.querySelectorAll('[data-spmode]').forEach(el => el.onchange = () => {
    const pr = S.params.production, v = el.value, pre = MTF.salePlanPresets[v];
    pr.salePlanMode = v;
    if (pre && pre.plan) pr.salePlan = JSON.parse(JSON.stringify(pre.plan));
    upd();
  });
  bindArr('[data-spa]', el => { planOf()[el.dataset.spa].age = Math.max(1, Math.round(parseFloat(el.value) || 1)); S.params.production.salePlanMode = 'custom'; });
  bindArr('[data-sps]', el => { planOf()[el.dataset.sps].share = Math.max(0, parseFloat(el.value) || 0); S.params.production.salePlanMode = 'custom'; });
  bindArr('[data-spp]', el => { planOf()[el.dataset.spp].price = Math.max(0, parseFloat(el.value) || 0); S.params.production.salePlanMode = 'custom'; });
  document.querySelectorAll('[data-spdel]').forEach(el => el.onclick = () => {
    planOf().splice(+el.dataset.spdel, 1); S.params.production.salePlanMode = 'custom'; upd();
  });
  const addSale = document.getElementById('addSaleRow');
  if (addSale) addSale.onclick = () => {
    planOf().push({ age: 12, share: 0, price: 400 }); S.params.production.salePlanMode = 'custom'; upd();
  };

  // стандартные статьи обслуживания стада
  const addCare = document.getElementById('addCareStd');
  if (addCare) addCare.onclick = () => {
    MTF.careStandard.forEach(c => {
      if (!S.opexItems.some(x => x.id === c.id)) S.opexItems.push(JSON.parse(JSON.stringify(c)));
    });
    upd();
  };
  bindArr('[data-subval]', el => S.subsidies[el.dataset.subval].value = parseFloat(el.value) || 0);
  bindArr('[data-sub]', el => S.subsidies[el.dataset.sub].enabled = el.checked);
  bindArr('[data-sec]', el => {
    S.docSections[el.dataset.sec].enabled = el.checked;
    S.docMode = 'custom';
  });
  document.querySelectorAll('[data-cmt]').forEach(el =>
    el.onchange = () => { S.subsidies[el.dataset.cmt].comment = el.value; MTF.save(); });

  const del = (sel, arr) => document.querySelectorAll(sel).forEach(el =>
    el.onclick = () => { S[arr].splice(+el.getAttribute(el.dataset.cxdel !== undefined ? 'data-cxdel' :
      el.dataset.oxdel !== undefined ? 'data-oxdel' : el.dataset.subdel !== undefined ? 'data-subdel' : 'data-delstaff'), 1); upd(); });
  document.querySelectorAll('[data-cxdel]').forEach(el => el.onclick = () => { S.capexItems.splice(+el.dataset.cxdel, 1); upd(); });
  document.querySelectorAll('[data-oxdel]').forEach(el => el.onclick = () => { S.opexItems.splice(+el.dataset.oxdel, 1); upd(); });
  document.querySelectorAll('[data-subdel]').forEach(el => el.onclick = () => { S.subsidies.splice(+el.dataset.subdel, 1); upd(); });
  document.querySelectorAll('[data-delstaff]').forEach(el => el.onclick = () => { S.staff.splice(+el.dataset.delstaff, 1); upd(); });
  document.querySelectorAll('[data-scdel]').forEach(el => el.onclick = () => { MTF.scenarios.splice(+el.dataset.scdel, 1); MTF.render(); });

  const btn = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
  document.querySelectorAll('[data-addcx]').forEach(el => el.onclick = () => {
    const g = el.dataset.addcx;
    const n = prompt('Название статьи');
    if (!n) return;
    const isEq = g === 'equip' || g === 'herd';
    S.capexItems.push({ id: 'c' + Date.now(), name: n, group: g,
      unit: isEq ? 'qty' : 'sum', value: 0, qty: isEq ? 1 : undefined,
      cur: MTF.groupCur(MTF.state.params, g) });
    upd();
  });
  btn('addOpex', () => {
    const n = prompt('Название статьи расходов');
    if (n) { S.opexItems.push({ id: 'o' + Date.now(), name: n, base: 'sum', value: 0 }); upd(); }
  });
  btn('addStaff', () => {
    const n = prompt('Название должности');
    if (n) { S.staff.push({ id: 's' + Date.now(), name: n, count: 1, salary: 400 }); upd(); }
  });
  btn('addSub', () => MTF.addSubsidy());
  btn('allOn', () => { S.subsidies.forEach(s => s.enabled = true); upd(); });
  btn('allOff', () => { S.subsidies.forEach(s => s.enabled = false); upd(); });
  btn('saveScen', () => {
    const name = prompt('Название сценария', 'Сценарий ' + (MTF.scenarios.length + 1));
    if (!name) return;
    const r = MTF.lastResult;
    MTF.scenarios.push({
      name: name, capex: r.capex.total, equity: r.funding.equity,
      npv: r.metrics.npv, irr: r.metrics.irr, pb: r.metrics.payback, dscr: r.metrics.minDscr
    });
    MTF.render();
  });
  btn('clearScen', () => { MTF.scenarios = []; MTF.render(); });

  const sp = document.getElementById('spread');
  if (sp) sp.onchange = () => {
    const arr = sp.value.split(',').map(x => parseFloat(x.trim()) || 0).filter(x => x > 0);
    MTF.state.params.finance.capexSpread = arr.length ? arr : [100];
    upd();
  };

  const dm = document.getElementById('docMode');
  if (dm) dm.onchange = () => { MTF.applyDocMode(S, dm.value); upd(); };

  ['expWord', 'expPdf', 'expCsv', 'editTpl'].forEach(id => btn(id, () => MTF.export[id]()));
};

MTF.addSubsidy = function () {
  const name = prompt('Название меры поддержки');
  if (!name) return;
  const type = prompt('Тип: per_liter / per_head / capex_pct / fixed_year / rate_sub', 'per_liter');
  const value = parseFloat(prompt('Ставка', '0')) || 0;
  MTF.state.subsidies.push({
    id: 's' + Date.now(), name: name, type: type, value: value,
    unit: type === 'per_liter' ? '₸/л' : type === 'capex_pct' ? '%' : 'т.₸',
    base: 'build', yearFrom: 1, yearTo: MTF.state.params.project.horizon,
    condition: '', conflictsWith: [], enabled: true, status: 'draft', comment: ''
  });
  MTF.save(); MTF.render();
};

/* Переносит в state все ключи сохранённого проекта, которых нет в основном списке:
   данные модулей (machinery, prepCosts, prepTeam, powerItems, waterItems, participants,
   fundingExtra, structureTexts, renewal*). Недостающее потом дополняют ensure* модулей. */
MTF.coreStateKeys = ['params', 'capexItems', 'staff', 'opexItems', 'subsidies', 'docSections', 'docMode', 'version', 'scenarios'];
MTF.carryExtras = function (st, src) {
  Object.keys(src || {}).forEach(function (k) {
    if (MTF.coreStateKeys.indexOf(k) < 0 && src[k] !== undefined && src[k] !== null) st[k] = src[k];
  });
  return st;
};

MTF.save = function () { try { sessionStorage.setItem('mtf', JSON.stringify(MTF.state)); } catch (e) { } };
MTF.load = function () {
  try {
    const raw = sessionStorage.getItem('mtf');
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || !o.params) return null;
    const base = MTF.initState();
    // сливаем сохранённое с дефолтами: новые поля не теряются
    Object.keys(base.params).forEach(k => {
      base.params[k] = Object.assign({}, base.params[k], o.params[k] || {});
    });
    // проект, сохранённый до появления выбора, считался с полной выручкой — не меняем его молча
    if (o.params.prices && o.params.prices.revenueScope === undefined) base.params.prices.revenueScope = 'all';
    const st = {
      params: base.params,
      capexItems: Array.isArray(o.capexItems) && o.capexItems.length ? o.capexItems : base.capexItems,
      staff: Array.isArray(o.staff) ? o.staff : base.staff,
      opexItems: Array.isArray(o.opexItems) ? o.opexItems : base.opexItems,
      subsidies: Array.isArray(o.subsidies) && o.subsidies.length ? o.subsidies : base.subsidies,
      docSections: MTF.mergeDocSections(o.docSections),
      docMode: o.docMode || 'estimate',
      version: MTF.VERSION
    };
    MTF.carryExtras(st, o);   // данные модулей (парк, подготовка, энергетика, структура, обновление)
    return st;
  } catch (e) { return null; }
};

window.addEventListener('DOMContentLoaded', function () {
  MTF.state = MTF.load() || MTF.initState();
  if (!MTF.state.docMode) MTF.state.docMode = 'estimate';
  if (MTF.state.docMode !== 'custom') MTF.applyDocMode(MTF.state, MTF.state.docMode);
  document.getElementById('ver').textContent = 'v' + MTF.VERSION;
  document.getElementById('btnSave').onclick = () => MTF.export.saveJson();
  document.getElementById('btnLoad').onclick = () => MTF.export.loadJson();
  document.getElementById('btnReset').onclick = () => {
    if (confirm('Сбросить все данные к значениям по умолчанию?')) {
      MTF.state = MTF.initState(); MTF.scenarios = []; MTF.save(); MTF.render();
    }
  };
  MTF.render();
});
