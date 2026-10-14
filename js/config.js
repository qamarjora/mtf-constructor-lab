/* ============================================================
   КОНФИГУРАЦИЯ ПРОЕКТА
   Здесь меняются справочники и значения по умолчанию.
   ============================================================ */

window.MTF = window.MTF || {};

MTF.VERSION = '1.3.5';

/* ---------- Валюты ----------
   base — валюта расчёта. Все суммы приводятся к ней.
   Курсы редактируются в интерфейсе.
------------------------------------------------ */
MTF.currencies = {
  KZT: { name: 'Тенге', sign: '₸', rate: 1 },
  EUR: { name: 'Евро', sign: '€', rate: 520 },
  USD: { name: 'Доллар', sign: '$', rate: 480 },
  RUB: { name: 'Рубль', sign: '₽', rate: 5.4 }
};

MTF.defaults = {
  project: {
    name: 'Сеть молочно-товарных ферм',
    region: '',
    district: '',
    farmsCount: 10,
    operator: '',
    startYear: 2027,
    horizon: 12,
    baseCurrency: 'KZT',
    displayCurrency: 'EUR',   // валюта сводного итога
    groupCurrency: {          // валюта отображения по группам капзатрат
      build: 'KZT', equip: 'EUR', herd: 'EUR'
    },
    rateEUR: 520,
    rateUSD: 480,
    rateRUB: 5.4
  },

  capacity: {
    cowPlaces: 400,
    dryPlaces: 75,
    calfPlaces: 120,
    heiferPlaces: 300,
    bullPlaces: 0,
    flexHousing: true      // размещать молодняк в свободных местах коровника
  },

  herd: {
    startHeifers: 470,
    batches: 2,
    batchInterval: 1,
    firstBatchShare: 50,
    heiferPrice: 2140,       // в валюте heiferCurrency, тыс. единиц
    heiferCurrency: 'KZT',
    gestationOnArrival: 5,
    breed: 'Голштинская',
    source: 'Импорт',
    restockMode: 'none',     // none | to_capacity — докуп нетелей по годам
    restockYears: 3,
    surplusHeiferPct: 85,    // цена сверхремонтной нетели, % от цены закупа
  },

  production: {
    yieldMode: 'year',       // year | lactation | daily
    milkYield: 8000,
    calvingRate: 78,
    cullRate: 26,              // выбраковка в установившемся режиме, % в год
    cullRateFreeYears: 1,      // сколько первых лет выбраковки нет вовсе, 0% (0 = не используется)
    cullRateStart: 10,         // выбраковка в пониженный период, % в год
    cullRateStartYears: 2,     // сколько лет после безвыбраковочного периода действует пониженная ставка (0 = не используется)
    calfMortality: 8,
    heiferMortality: 4,
    dryDays: 60,
    calvingPenDays: 14,      // дней в родильном отделении (до и после отёла)
    quarantineDays: 30,      // карантин завозного поголовья
    quarantineInBarn: true,  // карантин в свободном коровнике (только первый завоз)
    firstCalfYield: 85,      // удой первотёлки, % от взрослой коровы
    calvingSpreadMo: 0,      // разброс отёлов в завозной партии, мес. (0 — все в один месяц); влияет только на деление коров на группы
    heiferShare: 50,
    breedingAgeMo: 15,
    firstCalvingMo: 24,
    remontMode: 'own',
    bullMode: 'sell_calf',
    calfSaleAgeMo: 2,
    heiferKeepRatio: 130,      // сколько тёлок оставлять на ремонт, % к годовой потребности
    salePlanMode: 'early',     // схема продажи лишних тёлок: early | steps | late | custom
    salePlan: [{ age: 2, share: 100, price: 0 }],   // график продажи: возраст, мес. / доля, % / цена, тыс. ₸
    fattenAgeMo: 16,
    fattenWeightKg: 450
  },

  feed: {
    mode: 'purchase',        // purchase | own | lump
    dmCow: 20,
    dmDry: 13,
    dmHeifer: 7,
    dmCalf: 3,
    dmBull: 9,
    dmPriceCow: 90,
    dmPriceYoung: 60,
    landMode: 'perHead',     // fixed | perHead
    landHa: 1000,
    landHaPerCow: 1.5,
    landCostPerHa: 220000,
    lumpAnnual: 0            // фиксированная сумма в год, тыс. ₸
  },

  staff: {
    mode: 'detailed',        // detailed | lump
    lumpAnnual: 0,           // ФОТ одной суммой, тыс. ₸ в год
    scaleToHerd: true,       // масштабировать штат под фактическое поголовье (для блока, где не задано своё)
    baseCows: 472,           // поголовье, под которое составлено расписание
    shareFarms: 0,           // на сколько ферм делить общие блоки (0 = по количеству ферм)
    blocks: {                // три блока оплаты труда; scale: null — взять общую галочку scaleToHerd
      complex: { name: 'АУП комплекса', scope: 'project', scale: false },
      farm:    { name: 'АУП фермы и производственный персонал', scope: 'farm', scale: null },
      land:    { name: 'Земельный фонд', scope: 'project', scale: false }
    }
  },

  prices: {
    milk: 265,
    calf: 95,
    cullCow: 480,
    bullKg: 1900,
    revenueScope: 'milk',   // что входит в выручку: 'milk' — только молоко, 'all' — ещё телята, молодняк, выбраковка
    priceInflation: 6,
    costInflation: 8
  },

  finance: {
    lender: 'АО «Аграрная кредитная корпорация»',
    program: '',
    rate: 6,
    termYears: 12,
    graceYears: 2,
    financeShareBuild: 85,
    financeShareEquip: 90,
    financeShareHerd: 85,
    wcAuto: true,            // подбирать оборотный кредит автоматически
    wcCap: 0,                // лимит оборотного кредита, тыс. ₸ (0 = авто)
    wcRate: 6,
    wcTermYears: 5,
    wacc: 8,
    operatorFeeMode: 'revenue',
    operatorFeeValue: 3,
    capexSpread: [70, 30]    // распределение капзатрат по годам, %
  }
};

/* ---------- Статьи капитальных затрат ----------
   unit:  sum | place | head | qty (цена за единицу × количество)
   group: prep | build | equip | herd
   cur:   валюта статьи
------------------------------------------------ */
MTF.capexItems = [
  /* --- Подготовительный этап --- */

  /* --- Строительство --- */
  { id: 'b_all',   name: 'Строительство зданий и инфраструктура', group: 'build', unit: 'sum', value: 200000, cur: 'KZT' },
  { id: 'b_mount', name: 'Монтаж технологического оборудования',  group: 'build', unit: 'sum', value: 25000,  cur: 'KZT' },

  /* --- Оборудование доильно-молочного блока --- */
  { id: 'e_parallel', name: 'Доильная установка «Параллель», комплект', group: 'equip', unit: 'qty', value: 252000, qty: 1, cur: 'EUR', sect: 'ДМБ' },
  { id: 'e_fan5_dmb', name: 'Вентилятор горизонтальный Ø5 м (ДМБ)',    group: 'equip', unit: 'qty', value: 3606.6, qty: 3, cur: 'EUR', sect: 'ДМБ' },
  { id: 'e_fan7_dmb', name: 'Вентилятор горизонтальный Ø7 м (ДМБ)',    group: 'equip', unit: 'qty', value: 3606.6, qty: 1, cur: 'EUR', sect: 'ДМБ' },
  { id: 'e_fence_dmb', name: 'Разделительные заборы и калитки (ДМБ), пм', group: 'equip', unit: 'qty', value: 89.6, qty: 300, cur: 'EUR', sect: 'ДМБ' },
  { id: 'e_mats_dmb', name: 'Рулонные маты (ДМБ), пм',                  group: 'equip', unit: 'qty', value: 80, qty: 150, cur: 'EUR', sect: 'ДМБ' },

  /* --- Оборудование коровника --- */
  { id: 'e_mattress', name: 'Матрас 4-слойный 5,5 см',                  group: 'equip', unit: 'qty', value: 125, qty: 472, cur: 'EUR', sect: 'Коровник' },
  { id: 'e_stall',    name: 'Стойловое оборудование',                   group: 'equip', unit: 'qty', value: 100, qty: 550, cur: 'EUR', sect: 'Коровник' },
  { id: 'e_drink',    name: 'Поилки нержавеющие с подогревом 2,5×0,5',  group: 'equip', unit: 'qty', value: 1059.63, qty: 40, cur: 'EUR', sect: 'Коровник' },
  { id: 'e_fan5_barn', name: 'Вентилятор горизонтальный Ø5 м (коровник)', group: 'equip', unit: 'qty', value: 3606.6, qty: 20, cur: 'EUR', sect: 'Коровник' },
  { id: 'e_curtain',  name: 'Шторы автоматические ПВХ 1,5 м, пм',       group: 'equip', unit: 'qty', value: 149.7, qty: 252, cur: 'EUR', sect: 'Коровник' },
  { id: 'e_headlock', name: 'Кормовые заграждения ХЭДЛОК, пм',          group: 'equip', unit: 'qty', value: 166.5, qty: 210, cur: 'EUR', sect: 'Коровник' },
  { id: 'e_scraper',  name: 'Скреперная система навозоудаления, компл.', group: 'equip', unit: 'qty', value: 22000, qty: 6, cur: 'EUR', sect: 'Коровник' },
  { id: 'e_fence_barn', name: 'Разделительные заборы и калитки (коровник), пм', group: 'equip', unit: 'qty', value: 89.6, qty: 500, cur: 'EUR', sect: 'Коровник' },
  { id: 'e_brush',    name: 'Автоматическая щётка для коров',           group: 'equip', unit: 'qty', value: 2560.3, qty: 8, cur: 'EUR', sect: 'Коровник' },
  { id: 'e_shaft',    name: 'Шахты с вентилятором 14 тыс. м³',          group: 'equip', unit: 'qty', value: 750, qty: 29, cur: 'EUR', sect: 'Коровник' },
  { id: 'e_puzzle',   name: 'Пазловые маты',                           group: 'equip', unit: 'qty', value: 72, qty: 200, cur: 'EUR', sect: 'Коровник' },
  { id: 'e_simple_lock', name: 'Упрощённые кормовые заграждения, пм',   group: 'equip', unit: 'qty', value: 60, qty: 110, cur: 'EUR', sect: 'Коровник' },
  { id: 'e_calfhut',  name: 'Домики для телят',                        group: 'equip', unit: 'qty', value: 350, qty: 100, cur: 'EUR', sect: 'Коровник' },
  { id: 'e_hoof',     name: 'Станок гидравлический для обработки копыт', group: 'equip', unit: 'qty', value: 14956.9, qty: 2, cur: 'EUR', sect: 'Коровник' },
  { id: 'e_milktaxi', name: 'Молочное такси 250 л с подогревом',        group: 'equip', unit: 'qty', value: 11150, qty: 2, cur: 'EUR', sect: 'Коровник' },
  { id: 'e_belt',     name: 'Лента для кормового стола, пм',            group: 'equip', unit: 'qty', value: 0, qty: 276, cur: 'EUR', sect: 'Коровник' },

  /* --- Техника --- */
  { id: 't_mixer',    name: 'Кормораздатчик',                          group: 'equip', unit: 'qty', value: 56200, qty: 1, cur: 'EUR', sect: 'Техника' },
  { id: 't_loader1',  name: 'Погрузчик',                               group: 'equip', unit: 'qty', value: 46820, qty: 1, cur: 'EUR', sect: 'Техника' },
  { id: 't_milktruck', name: 'Молоковоз',                              group: 'equip', unit: 'qty', value: 125000, qty: 1, cur: 'EUR', sect: 'Техника' },
  { id: 't_manitou',  name: 'Телескопический погрузчик',               group: 'equip', unit: 'qty', value: 65500, qty: 1, cur: 'EUR', sect: 'Техника' },
  { id: 't_loader2',  name: 'Погрузчик (второй)',                      group: 'equip', unit: 'qty', value: 46810, qty: 1, cur: 'EUR', sect: 'Техника' },

  /* --- Оборудование галереи --- */
  { id: 'g_fence',    name: 'Разделительные заборы и калитки (галерея), пм', group: 'equip', unit: 'qty', value: 89.6, qty: 180, cur: 'EUR', sect: 'Галерея' },
  { id: 'g_mats',     name: 'Рулонные маты (галерея), пм',             group: 'equip', unit: 'qty', value: 80, qty: 168, cur: 'EUR', sect: 'Галерея' },

  /* --- Оборудование предлагуны --- */
  { id: 'l_separator', name: 'Сепаратор 5,5 кВт',                      group: 'equip', unit: 'qty', value: 34333.2, qty: 1, cur: 'EUR', sect: 'Предлагуна' },
  { id: 'l_pump37',   name: 'Насос погружной 37 кВт',                  group: 'equip', unit: 'qty', value: 31059, qty: 1, cur: 'EUR', sect: 'Предлагуна' },
  { id: 'l_pump22',   name: 'Насос погружной 22 кВт',                  group: 'equip', unit: 'qty', value: 14912.2, qty: 1, cur: 'EUR', sect: 'Предлагуна' },
  { id: 'l_pump55',   name: 'Насос погружной 5,5 кВт',                 group: 'equip', unit: 'qty', value: 13525.5, qty: 1, cur: 'EUR', sect: 'Предлагуна' },
  { id: 'l_manmixer', name: 'Миксер навозный',                        group: 'equip', unit: 'qty', value: 12733, qty: 1, cur: 'EUR', sect: 'Предлагуна' },

  { id: 'herd',      name: 'Закуп нетелей',                  group: 'herd',  unit: 'head',  value: 0, cur: 'KZT', auto: true }
];

MTF.capexReserve = 7;

/* ---------- Штатное расписание ---------- */
/* Типовые должности по блокам. Блоки комплекса и земельного фонда
   заведены пустыми (количество и оклады вносятся вручную). */
MTF.staffStandard = {
  complex: [
    { id: 'c_mgr',  name: 'Управляющий комплекса',                     count: 0, salary: 0 },
    { id: 'c_acc',  name: 'Бухгалтер',                                 count: 0, salary: 0 },
    { id: 'c_mts',  name: 'Отдел материально-технического снабжения',  count: 0, salary: 0 },
    { id: 'c_hr',   name: 'Отдел кадров',                              count: 0, salary: 0 },
    { id: 'c_law',  name: 'Юрист-брокер',                              count: 0, salary: 0 }
  ],
  farm: [
    { id: 'director',    name: 'Заведующий фермой',         count: 1, salary: 900 },
    { id: 'zootech',     name: 'Зоотехник',                 count: 1, salary: 700 },
    { id: 'vet',         name: 'Главный ветеринарный врач', count: 1, salary: 700 },
    { id: 'hr_farm',     name: 'Управляющий персоналом',    count: 1, salary: 600 },
    { id: 'inseminator', name: 'Техник-осеменатор',         count: 1, salary: 600 },
    { id: 'milker',      name: 'Оператор машинного доения', count: 6, salary: 400 },
    { id: 'cattleman',   name: 'Скотник',                   count: 6, salary: 350 },
    { id: 'mechanic',    name: 'Механизатор',               count: 3, salary: 450 },
    { id: 'tech',        name: 'Слесарь-наладчик',          count: 2, salary: 400 },
    { id: 'security',    name: 'Охрана',                    count: 4, salary: 300 }
  ],
  land: [
    { id: 'l_agro',  name: 'Старший агроном',  count: 0, salary: 0 },
    { id: 'l_tract', name: 'Тракторист',       count: 0, salary: 0 },
    { id: 'l_field', name: 'Полевой рабочий',  count: 0, salary: 0 }
  ]
};
MTF.staff = [];
['complex', 'farm', 'land'].forEach(function (b) {
  MTF.staffStandard[b].forEach(function (r) {
    MTF.staff.push(Object.assign({ block: b }, r));
  });
});

MTF.payrollTaxRate = 35;

/* ---------- Операционные расходы ----------
   base: head | cow | sum | milk
------------------------------------------------ */
/* Обслуживание стада: ориентировочные ставки, тыс. ₸ в год.
   cow — на фуражную корову, young — на голову молодняка.
   Значения заведены как ориентир и подлежат уточнению у зоотехника. */
MTF.careStandard = [
  { id: 'care_vet',   name: 'Ветеринарные препараты и вакцинация',      base: 'cow',   value: 28 },
  { id: 'care_diag',  name: 'Ветеринарное обслуживание и диагностика',  base: 'cow',   value: 14 },
  { id: 'care_young', name: 'Ветобслуживание молодняка',                base: 'young', value: 12 },
  { id: 'care_semen', name: 'Семя и осеменение',                        base: 'cow',   value: 30 },
  { id: 'care_hoof',  name: 'Обрезка и уход за копытами',               base: 'cow',   value: 4 },
  { id: 'care_lab',   name: 'Лабораторные исследования стада',          base: 'cow',   value: 3 }
];
MTF.opexItems = JSON.parse(JSON.stringify(MTF.careStandard));

/* Затраты на карантин: тыс. ₸ на голову единовременно */
MTF.quarantineCostPerHead = 45;

MTF.taxes = {
  landTax: 800,
  propertyTaxRate: 0.5,
  cit: 0,
  depreciationYears: 20
};

/* ---------- Курс валюты ---------- */
MTF.rate = function (p, cur) {
  if (!cur || cur === 'KZT') return 1;
  if (cur === 'EUR') return p.project.rateEUR || 520;
  if (cur === 'USD') return p.project.rateUSD || 480;
  if (cur === 'RUB') return p.project.rateRUB || 5.4;
  return 1;
};

/* ---------- Отображение сумм в выбранной валюте ----------
   Все расчёты ведутся в тысячах тенге. Эти функции переводят
   итоги в валюту отображения только для показа.
------------------------------------------------ */
MTF.dispCur = function (p) {
  return (p.project && p.project.displayCurrency) || 'KZT';
};
MTF.dispSign = function (p) {
  const c = MTF.dispCur(p);
  return (MTF.currencies[c] || MTF.currencies.KZT).sign;
};
MTF.disp = function (p, kzt, cur) {
  const c = cur || MTF.dispCur(p);
  if (c === 'KZT') return kzt;
  return kzt / MTF.rate(p, c);
};

/* Валюта отображения конкретной группы капзатрат */
MTF.groupCur = function (p, g) {
  const m = (p.project && p.project.groupCurrency) || {};
  return m[g] || 'KZT';
};
MTF.groupSign = function (p, g) {
  return (MTF.currencies[MTF.groupCur(p, g)] || MTF.currencies.KZT).sign;
};

/* ---------- Схемы продажи лишних тёлок ----------
   plan: возраст в месяцах, доля от лишних тёлок в процентах и цена в тыс. ₸.
   У строки, где возраст не больше возраста продажи телят, цена не вводится:
   берётся цена телёнка из вкладки «Вводные». */
MTF.salePlanPresets = {
  early:  { name: 'Ранняя: всё в возрасте продажи телят', plan: [{ age: 2, share: 100, price: 0 }] },
  steps:  { name: 'Три ступени: 2, 6 и 12 месяцев', plan: [
            { age: 2, share: 33.4, price: 0 }, { age: 6, share: 33.3, price: 220 }, { age: 12, share: 33.3, price: 400 }] },
  late:   { name: 'Поздняя: всё в 12 месяцев', plan: [{ age: 12, share: 100, price: 400 }] },
  custom: { name: 'Свой график', plan: null }
};
