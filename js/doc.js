/* ============================================================
   ГЕНЕРАТОР ДОКУМЕНТА
   ============================================================ */

window.MTF = window.MTF || {};


/* ============================================================
   РЕЖИМЫ ДОКУМЕНТА
   Каждый режим — свой набор разделов и своё название.
   Добавить режим = дописать объект в этот список.
   ============================================================ */
MTF.docModes = [
  {
    id: 'estimate',
    name: 'Смета проекта',
    label: 'Смета проекта',
    hint: 'Стоимость фермы по группам затрат. Без финансовой модели.',
    sections: ['concept', 'farm', 'estimate', 'equipment', 'stages', 'disclaimer']
  },
  {
    id: 'technical',
    name: 'Техническое описание фермы',
    label: 'Техническое описание',
    hint: 'Планировка, помещения, технология, оборудование. Для подрядчиков и поставщиков.',
    sections: ['concept', 'farm', 'equipment', 'stages', 'disclaimer']
  },
  {
    id: 'passport',
    name: 'Паспорт проекта',
    label: 'Паспорт проекта',
    hint: 'Мощность, объёмы производства, состав затрат. Под инвестиционное субсидирование.',
    sections: ['concept', 'farm', 'herddyn', 'estimate', 'equipment', 'finmodel',
               'subsidycompare', 'stages', 'disclaimer']
  },
  {
    id: 'bizplan',
    name: 'Бизнес-план',
    label: 'Бизнес-план',
    hint: 'Полный формат для кредитора: производство, экономика, финансирование, риски.',
    sections: ['concept', 'farm', 'herddyn', 'estimate', 'equipment', 'stages', 'finmodel',
               'subsidycompare', 'consolidated', 'operator', 'risks', 'disclaimer']
  },
  {
    id: 'investment',
    name: 'Инвестиционное предложение',
    label: 'Инвестиционное предложение',
    hint: 'Для привлечения инвесторов: доходность, условия участия, ограничения.',
    sections: ['concept', 'farm', 'deal', 'estimate', 'finmodel', 'subsidycompare',
               'consolidated', 'operator', 'limits', 'risks', 'disclaimer']
  },
  {
    id: 'custom',
    name: 'Свой набор разделов',
    label: 'Модель проекта',
    hint: 'Разделы выбираются вручную галочками.',
    sections: null
  }
];

/* Слияние сохранённого набора разделов с текущим.
   Правки текста и галочки пользователя сохраняются, разделы, добавленные
   в новой версии инструмента, подставляются на своё место — иначе старый
   .json навсегда прятал бы новые разделы. Заголовки берутся из кода:
   вручную они не правятся, а нумерация в них меняется между версиями. */
MTF.mergeDocSections = function (saved) {
  const base = JSON.parse(JSON.stringify(MTF.docSections));
  if (!Array.isArray(saved) || !saved.length) return base;
  const byId = {};
  saved.forEach(s => { if (s && s.id) byId[s.id] = s; });
  const merged = base.map(b => {
    const s = byId[b.id];
    if (!s) return b;
    /* Сохранённый текст берём только если пользователь правил его руками
       (флаг ставит MTF.export.editTpl). Иначе выигрывает текст из кода:
       раньше сохранённое тело перебивало код всегда, и правки шаблонов
       новой версии не доходили до открытой сессии и до старого .json. */
    const keep = s.edited && s.body;
    return {
      id: b.id, title: b.title, enabled: !!s.enabled,
      body: keep ? s.body : b.body,
      edited: keep ? true : undefined
    };
  });
  // разделы, которых в текущем наборе нет — добавленные пользователем, не теряем
  saved.forEach(s => {
    if (s && s.id && !base.some(b => b.id === s.id)) merged.push(s);
  });
  return merged;
};

MTF.applyDocMode = function (state, modeId) {
  const m = MTF.docModes.find(x => x.id === modeId);
  state.docMode = modeId;
  if (!m || !m.sections) return;
  state.docSections.forEach(s => { s.enabled = m.sections.indexOf(s.id) >= 0; });
};

MTF.docSections = [
  {
    id: 'concept', title: '1. Общая концепция проекта', enabled: true,
    body: `**1.1. Суть проекта**

Проект предусматривает создание и эксплуатацию {{farmsCount}} молочно-товарных ферм (МТФ) одинаковой мощности. Место реализации — Республика Казахстан, {{region}} область, {{district}} район.

Основной продукт — сырое молоко, реализуемое на перерабатывающие предприятия региона. {{revenueScopeNote}}

**1.2. Масштаб проекта**

- Количество ферм: {{farmsCount}}
- Мощность одной фермы: {{capacityCows}} фуражных коров, в том числе {{cowPlaces}} дойных
- Поголовье одной фермы с ремонтным молодняком: {{totalAtCapacity}} голов
- Мощность проекта в целом ({{farmsCount}} ферм): {{totalCows}} фуражных коров
- Тип фермы: молочно-товарная, беспривязного содержания
- Воспроизводство: искусственное осеменение
- Стартовое поголовье одной фермы: {{startHeifers}} нетелей, завоз в {{batches}} партии

Если не указано иное, показатели в документе приведены на одну ферму. Показатели проекта в целом получены умножением на число ферм.

**1.3. Структура участия**

В проекте участвуют инициаторы, инвестор и государство (меры поддержки). Каждая ферма — отдельный объект инвестирования. [УТОЧНИТЬ: юридическая модель владения и участия — см. раздел «Структура сделки»]

**1.4. Оператор проекта**

Управление фермами по единым технологическим, производственным и финансовым стандартам осуществляет {{operator}}. [УТОЧНИТЬ: статус Оператора — управляющая компания, участник проекта или владелец одной из ферм]`
  },
  {
    id: 'farm', title: '2. Описание типовой фермы', enabled: true,
    body: `Все показатели раздела приведены на одну типовую ферму.

**2.1. Ёмкость комплекса**

{{capacityTable}}

**2.2. Продуктивность**

{{productionTable}}

**2.3. Производственный цикл**

Движение поголовья по зонам комплекса:

- Завозное поголовье проходит карантин продолжительностью {{quarantineDays}} дней
- Дойные коровы содержатся в коровнике, осеменение проводится в зоне доильно-молочного блока
- За {{dryDays}} дней до отёла корова переводится в родильно-сухостойный блок
- Отёл и последующие {{calvingPenDays}} дней — родильное отделение
- После отёла корова возвращается в дойное стадо, телёнок переводится в телятник
- В возрасте {{calfSaleAge}} мес. телята переводятся из телятника: тёлочки — в группу ремонтного молодняка, бычки — на реализацию
- Ремонтные тёлки содержатся до возраста первого отёла ({{firstCalvingMo}} мес.), после чего вводятся в основное стадо

Воспроизводство осуществляется методом искусственного осеменения. Ремонт стада — {{remontModeText}}. Реализация бычков — {{bullModeText}}.

**2.4. Расчётная структура стада**

{{structureTable}}
`
  },
  {
    id: 'herddyn', title: '3. Динамика стада', enabled: false,
    body: `Прогноз изменения поголовья одной фермы при выбранной схеме формирования стада.

{{herdTable}}`
  },
  {
    id: 'estimate', title: '4. Стоимость проекта', enabled: true,
    body: `Расчёт стоимости создания одной типовой фермы. Суммы в тыс. ₸. Стоимость проекта в целом ({{farmsCount}} ферм) равна стоимости одной фермы, умноженной на {{farmsCount}}.

**Капитальные затраты одной фермы**

{{capexTable}}

Стоимость строительства приведена предварительно и подлежит уточнению по проектно-сметной документации и коммерческим предложениям подрядчиков. Монтаж доильного оборудования выполняется поставщиком и в смету не включён.

{{estimateFundingBlock}}

{{estimateTotalBlock}}`
  },
  {
    id: 'equipment', title: '5. Оборудование и техника', enabled: true,
    body: `Комплект технологического оборудования типовой фермы.

{{equipTable}}

Полная спецификация по позициям приводится в приложении к настоящему документу.`
  },
  {
    id: 'deal', title: '6. Структура сделки', enabled: false,
    body: `**6.1. Участники и роли**

{{structIntro}}

{{participantsTable}}

**6.2. Правовая модель**

Предварительная модель: каждая ферма — отдельный объект инвестирования, управление всеми фермами по единым стандартам осуществляет Оператор на основании договора управления. [УТОЧНИТЬ: юридическая форма (консорциум, отдельные юридические лица по фермам, иное), ответственность сторон, порядок вхождения и выхода инвестора]

**6.3. Что получает инвестор**

{{structGuarantees}}

**6.4. Договор управления**

Условия вознаграждения Оператора приведены в разделе «Роль Оператора». [УТОЧНИТЬ: срок договора, порядок расторжения, показатели результативности Оператора]

**6.5. Расходы до финансирования**

{{prepDealBlock}}`
  },
  {
    id: 'stages', title: '7. Этапы реализации', enabled: true,
    body: `**Этап 1. Подготовительный** — оформление земельных участков, проектирование (ПСД), геология, топосъёмка, экспертиза, юридическое сопровождение. Статьи расходов — в приложении «Подготовительный этап».

**Этап 2. Разрешительный** — получение разрешений на строительство, подключение инфраструктуры, согласования с уполномоченными органами.

**Этап 3. Финансирование** — подготовка пакета документов, структурирование сделки, получение финансирования.

**Этап 4. Строительство** — выбор подрядчика, строительство комплекса, контроль сроков и бюджета.

**Этап 5. Завоз поголовья** — карантин, ветеринарные мероприятия, ввод в стадо.

**Этап 6. Эксплуатация** — запуск производственного цикла, управление через Оператора, реализация продукции.

**Сроки.** [УТОЧНИТЬ: календарный план этапов — от подписания до выхода на проектную мощность]`
  },
  {
    id: 'finmodel', title: '8. Финансовая модель', enabled: false,
    body: `Расчёт выполнен для одной типовой фермы на горизонте {{horizon}} лет ({{startYear}}–{{endYear}} гг.). Показатели проекта в целом ({{farmsCount}} ферм) получены умножением на число ферм: фермы приняты одинаковыми, общие затраты проекта уже распределены между ними поровну.

**8.1. Инвестиционные метрики**

{{metricsTable}}

**8.2. Структура финансирования**

<p><i>Одна ферма, тыс. ₸</i></p>
{{fundingTable}}

**8.3. Прогноз финансовых показателей**

<p><i>Одна ферма, тыс. ₸ в ценах соответствующего года</i></p>
{{pnlTable}}

{{projPnlBlock}}

**8.4. График погашения**

<p><i>Одна ферма, тыс. ₸. Кредит проекта в целом — в {{farmsCount}} раз больше.</i></p>
{{debtTable}}

**8.5. Доходность на вложения инвестора**

<p><i>Инвестор, владеющий одной фермой</i></p>
{{exitTable}}

**8.6. Государственная поддержка**

<p><i>Меры, учтённые в расчёте одной фермы</i></p>
{{subsidyTable}}

{{finRenewalBlock}}`
  },
  {
    id: 'subsidycompare', title: '9. Сравнение сценариев с господдержкой и без', enabled: false,
    body: `Проект просчитан в двух вариантах: с учётом включённых мер государственной поддержки и полностью без них. Базовый сценарий без субсидий показывает, выдерживает ли проект нагрузку самостоятельно, если условия субсидирования изменятся или заявка не пройдёт.

Второй вариант пересчитан целиком, а не уменьшением выручки на сумму субсидий: меры поддержки влияют и на ставку вознаграждения по кредиту, а через неё — на график погашения, денежные потоки и покрытие долга.

<p><i>Одна ферма. Для проекта в целом ({{farmsCount}} ферм) суммы в таблице умножаются на {{farmsCount}}.</i></p>
{{subsidyComparisonTable}}`
  },
  {
    id: 'consolidated', title: '10. Консолидация по проекту', enabled: false,
    body: `Показатели проекта в целом при реализации {{farmsCount}} ферм.

{{consolidatedTable}}`
  },
  {
    id: 'operator', title: '11. Роль Оператора', enabled: true,
    body: `Оператор проекта выполняет функцию единого центра управления:

- Подготовка проекта: ПСД, экспертиза, земельные вопросы, разрешительная документация
- Сопровождение финансирования: взаимодействие с кредиторами, структурирование сделок
- Координация строительства: выбор подрядчика, контроль сроков и бюджета
- Управление эксплуатацией: единые стандарты, производственные процессы, реализация продукции
- Финансовая прозрачность: учёт, отчётность, контроль расходов

**Вознаграждение Оператора**

{{operatorFeeText}}. {{operatorFeeAmount}}

**Ожидаемые преимущества для инвестора**

- Снижение операционных и строительных рисков за счёт единого управления
- Экономия на масштабе при закупе кормов, оборудования и поголовья
- Стандартизация процессов и прогнозируемый результат
- Возможность участия без опыта в животноводстве

[УТОЧНИТЬ: подтверждение компетенций Оператора — опыт, действующие проекты, фактические показатели]`
  },
  {
    id: 'limits', title: '12. Ограничения и обязательства инвестора', enabled: false,
    body: `[УТОЧНИТЬ: условия ниже предварительные, перед использованием согласовать с юристом]

**12.1.** Ограничение на выход из проекта — на стадии строительства до ввода в эксплуатацию, на операционной стадии — не менее 3 лет с даты запуска фермы.

**12.2.** Ограничение распоряжения активами — отчуждение, залог (кроме финансирующих организаций) и аренда фермы требуют согласия Оператора.

**12.3.** Обязательность договора управления на единых условиях.

**12.4.** Ограничение конкуренции и запрет на привлечение персонала — в течение срока участия и 3 лет после его прекращения.`
  },
  {
    id: 'risks', title: '13. Риски и их снижение', enabled: true,
    body: `**Производственные риски** — падёж, снижение продуктивности, проблемы воспроизводства. Снижение: ветеринарный контроль, квалифицированный персонал, страхование поголовья.

**Рыночные риски** — снижение закупочной цены на молоко, рост стоимости кормов. Снижение: долгосрочные договоры с переработчиками, формирование кормовых запасов.

**Финансовые риски** — рост стоимости заимствований, кассовые разрывы. Снижение: льготное финансирование, оборотный кредит, резервный фонд.

**Валютные риски** — оборудование и поголовье закупаются за валюту, выручка формируется в тенге. Ослабление тенге удорожает проект. Снижение: фиксация цен в контрактах, закуп до начала строительства.

**Регуляторные риски** — изменение правил субсидирования. Снижение: расчёт базового сценария без учёта субсидий.

**Строительные риски** — удорожание, срыв сроков. Снижение: единый подрядчик, фиксированная цена, контроль Оператора.

**Чувствительность результата**

Каждый сценарий пересчитан моделью целиком.

<p><i>Одна ферма</i></p>
{{riskSensTable}}`
  },
  {
    id: 'disclaimer', title: 'Оговорка', enabled: true,
    body: `Настоящий документ является информационным материалом и не является офертой. Все финансовые показатели носят прогнозный характер и могут изменяться в зависимости от рыночных условий, стоимости ресурсов, условий финансирования и иных факторов. Расчёты подлежат уточнению при подготовке проектно-сметной документации и структурировании сделки.`
  }
];

MTF.remontModeText = {
  own: 'выращивание собственного ремонтного молодняка',
  purchase: 'ежегодное приобретение нетелей',
  outsource: 'выращивание ремонтного молодняка на специализированной площадке'
};
MTF.bullModeText = {
  sell_calf: 'реализация телятами в возрасте до 2 месяцев',
  rearing: 'доращивание с последующей реализацией',
  fatten: 'полный откорм с реализацией живым весом'
};

/* Таблица в формате документа */
function dt(head, rows, align) {
  return '<table class="dt"><thead><tr>' +
    head.map((h, i) => '<th' + (i > 0 && align !== false ? ' class="r"' : '') + '>' + h + '</th>').join('') +
    '</tr></thead><tbody>' + rows.map(r => '<tr>' +
    r.map((c, i) => '<td' + (i > 0 && align !== false ? ' class="r n"' : '') + '>' + c + '</td>').join('') +
    '</tr>').join('') + '</tbody></table>';
}

/* Строка с курсом над таблицей, где есть валютные суммы.
   curs — коды валют, которые в этой таблице реально встречаются; тенге
   игнорируется. Если валютных статей нет, возвращается пустая строка
   и над таблицей ничего не появляется. */
MTF.rateNote = function (p, curs) {
  const order = ['EUR', 'USD', 'RUB'];
  const list = order.filter(c => curs.indexOf(c) >= 0);
  if (!list.length) return '';
  const parts = list.map(c => {
    const r = MTF.rate(p, c);
    return MTF.fmt.num(r, r < 10 ? 2 : 0) + ' ₸ за 1 ' +
      ((MTF.currencies[c] || {}).sign || c);
  });
  return '<p><i>Пересчёт по курсу ' + parts.join(', ') + '.</i></p>\n';
};

MTF.docTables = function (state, res) {
  const f = MTF.fmt, m = res.metrics, fd = res.funding, p = state.params;
  const N = p.project.farmsCount, lastH = res.herd[res.herd.length - 1];
  /* Курс показываем только по валютам, которые есть в статьях капзатрат */
  const rateLine = MTF.rateNote(p, res.capex.rows.map(r => r.cur));

  return {
    capacityTable: dt(['Помещение', 'Скотомест'], [
      ['Коровник (дойное стадо)', f.num(p.capacity.cowPlaces)],
      ['Родильно-сухостойный блок', f.num(p.capacity.dryPlaces)],
      ['Телятник', f.num(p.capacity.calfPlaces)],
      ['Помещения ремонтного молодняка', f.num(p.capacity.heiferPlaces)],
      ['Откормочная площадка', f.num(p.capacity.bullPlaces)],
      ['<b>Проектная мощность, фуражных коров</b>', '<b>' + f.num(res.herd.meta.target) + '</b>']
    ]),
    productionTable: dt(['Показатель', 'Значение'], [
      ['Порода', p.herd.breed],
      ['Источник поголовья', p.herd.source],
      ['Удой на фуражную корову, л/год', f.num(res.herd.meta.yieldYear)],
      ['Доля дойных в стаде', f.pct(res.herd.meta.milkingShare * 100, 0)],
      ['Выход телят на 100 коров', f.num(p.production.calvingRate)],
      ...MTF.docCullRows(p, f),
      ['Дней сухостоя', f.num(p.production.dryDays)],
      ['Возраст первого отёла, мес.', f.num(p.production.firstCalvingMo)]
    ]),
    structureTable: (function () {
      const P = p.production, tgt = res.herd.meta.target;
      const M = res.herd.meta;
      // расчёт шлейфа при выходе на проектную мощность
      const need = tgt * P.cullRate / 100;
      const heifersFull = need * (P.firstCalvingMo - P.calfSaleAgeMo) / 12;
      const bornYear = tgt * P.calvingRate / 100 * (1 - P.calfMortality / 100);
      const calvesFull = bornYear * P.calfSaleAgeMo / 12;
      const totalFull = tgt + heifersFull + calvesFull;
      return dt(['Группа', 'Доля стада', 'Голов при полной мощности'], [
        ['Дойные коровы', f.pct(M.milkingShare * 100, 0), f.num(tgt * M.milkingShare)],
        ['Сухостойные', f.pct(M.dryShare * 100, 0), f.num(tgt * M.dryShare)],
        ['Родильное отделение', f.pct(M.penShare * 100, 0), f.num(tgt * M.penShare)],
        ['<b>Фуражное поголовье</b>', '<b>100%</b>', '<b>' + f.num(tgt) + '</b>'],
        ['Ремонтный молодняк', '—', f.num(heifersFull)],
        ['Телята до ' + P.calfSaleAgeMo + ' мес.', '—', f.num(calvesFull)],
        ['<b>Общее поголовье</b>', '—', '<b>' + f.num(totalFull) + '</b>']
      ]);
    })(),
    herdTable: dt(['Год', 'Фуражное', 'Дойные, декабрь', 'Дойные, пик по месяцам (расчёт)',
        'Сухостой + родилка, пик по месяцам (расчёт)', 'Молодняк', 'Всего', 'Надой, т'],
      res.herd.map(y => [y.year, f.num(y.cows), f.num(y.milking), f.num(y.milkingPeak), f.num(y.dryPenPeak),
        f.num(y.heifers), f.num(y.total), f.num(y.milkLiters / 1000)])) +
      '<p><i>Значения «пик по месяцам (расчёт)» — максимум численности группы в течение года, полученный помесячным расчётом ' +
      'по датам отёлов завозных партий. Это расчётная оценка для планирования размещения; она не означает недостатка мест.</i></p>',
    metricsTable: dt(['Показатель', 'Ед.', '1 ферма', N + ' ферм'], [
      ['Стоимость проекта', 'тыс. ₸', f.num(res.capex.total), f.num(res.capex.total * N)],
      ['Собственное участие', 'тыс. ₸', f.num(fd.equity), f.num(fd.equity * N)],
      ['Лимит займа', 'тыс. ₸', f.num(fd.loanTotal), f.num(fd.loanTotal * N)],
      ['Доля заёмных средств', '%', f.pct(fd.loanShare, 0), f.pct(fd.loanShare, 0)],
      ['Ставка вознаграждения', '%', f.pct(fd.effectiveRate, 1), f.pct(fd.effectiveRate, 1)],
      ['Ставка дисконтирования', '%', f.pct(p.finance.wacc, 1), f.pct(p.finance.wacc, 1)],
      ['NPV', 'тыс. ₸', f.num(m.npv), f.num(m.npv * N)],
      ['IRR проекта', '%', m.irr !== null ? f.pct(m.irr * 100) : '—', m.irr !== null ? f.pct(m.irr * 100) : '—'],
      ['Простая окупаемость', 'лет', m.payback ? m.payback.toFixed(1) : '—', m.payback ? m.payback.toFixed(1) : '—'],
      ['Дисконтированная окупаемость', 'лет', m.discountedPayback ? m.discountedPayback.toFixed(1) : '—', m.discountedPayback ? m.discountedPayback.toFixed(1) : '—'],
      ['Минимальный DSCR за весь срок', '', isFinite(m.minDscr) ? m.minDscr.toFixed(2) : '—', isFinite(m.minDscr) ? m.minDscr.toFixed(2) : '—'],
      ['Минимальный DSCR со 2-го года', '', isFinite(m.minDscrY2) ? m.minDscrY2.toFixed(2) : '—', isFinite(m.minDscrY2) ? m.minDscrY2.toFixed(2) : '—']
    ]) + '\n<p><i>Минимальный DSCR со второго года рассчитан без учёта первого года ' +
      'проекта: в нём проходят пусконаладка и наполнение стада, обслуживание долга ' +
      'уже началось, а выход на проектную продуктивность ещё нет.</i></p>',
    estimateTotalTable: (function () {
      const N = p.project.farmsCount, P = p.production, tgt = res.herd.meta.target;
      const need = tgt * P.cullRate / 100;
      const h = need * (P.firstCalvingMo - P.calfSaleAgeMo) / 12;
      const c = tgt * P.calvingRate / 100 * (1 - P.calfMortality / 100) * P.calfSaleAgeMo / 12;
      const totHead = tgt + h + c;
      return dt(['Показатель', '1 ферма', N + ' ферм'], [
        ['Стоимость, млн ₸', f.num(res.capex.total / 1000, 1), f.num(res.capex.total * N / 1000, 1)],
        ['Стоимость, тыс. ₸', f.num(res.capex.total), f.num(res.capex.total * N)],
        ['Фуражных коров, гол.', f.num(tgt), f.num(tgt * N)],
        ['Общее поголовье с молодняком, гол.', f.num(totHead), f.num(totHead * N)],
        ['Стоимость на 1 фуражную корову, тыс. ₸',
          f.num(res.capex.total / Math.max(1, tgt)),
          f.num(res.capex.total / Math.max(1, tgt))]
      ]);
    })(),
    equipTable: (function () {
      const dc = MTF.dispCur(p), dsg = MTF.dispSign(p), dd = dc === 'KZT' ? 0 : 1;
      const eq = res.capex.rows.filter(r => r.group === 'equip');
      const byS = {};
      eq.forEach(r => {
        const it = state.capexItems.find(x => x.id === r.id);
        const k = (it && it.sect) || 'Прочее оборудование';
        if (!byS[k]) byS[k] = { n: 0, sum: 0 };
        byS[k].n++; byS[k].sum += r.sum;
      });
      const order = ['ДМБ', 'Коровник', 'Техника', 'Галерея', 'Предлагуна', 'Прочее оборудование'];
      const names = { 'ДМБ': 'Доильно-молочный блок', 'Коровник': 'Коровник и содержание',
        'Техника': 'Сельскохозяйственная техника', 'Галерея': 'Галерея и переходы',
        'Предлагуна': 'Навозоудаление и предлагуна' };
      const rows = order.filter(k => byS[k]).map(k =>
        [names[k] || k, f.num(byS[k].n), f.num(MTF.disp(p, byS[k].sum, dc), dd)]);
      const tot = eq.reduce((a, r) => a + r.sum, 0);
      rows.push(['<b>Итого оборудование и техника</b>', '<b>' + f.num(eq.length) + '</b>',
        '<b>' + f.num(MTF.disp(p, tot, dc), dd) + '</b>']);
      return rateLine + dt(['Узел комплекса', 'Позиций', 'Стоимость, тыс. ' + dsg], rows);
    })(),
    capexTable: (function () {
      const GN = { build: 'Строительство и монтаж',
                   equip: 'Оборудование и техника', herd: 'Поголовье' };
      const rows = ['build', 'equip', 'herd']
        .filter(g => res.capex.groups[g] > 0).map(g => {
          const gc = MTF.groupCur(p, g), gs = MTF.groupSign(p, g);
          return [GN[g],
            f.num(MTF.disp(p, res.capex.groups[g], gc), gc === 'KZT' ? 0 : 1) + ' ' + gs,
            f.num(res.capex.groups[g]),
            f.pct(res.capex.groups[g] / res.capex.total * 100, 1)];
        });
      rows.push(['<b>Итого стоимость фермы</b>', '—',
        '<b>' + f.num(res.capex.total) + '</b>', '<b>100%</b>']);
      return rateLine + dt(['Группа затрат', 'В валюте закупа', 'Тыс. ₸', 'Доля'], rows);
    })(),
    fundingTable: (function () {
      const GN = { build: 'Строительство', equip: 'Оборудование и техника',
                   herd: 'Закуп поголовья' };
      /* Пустые группы не показываем: ноль в смете читается как забытая
         статья, а не как «этой статьи в проекте нет». */
      const rows = ['build', 'equip', 'herd']
        .filter(g => res.capex.groups[g] > 0)
        .map(g => [GN[g], f.num(res.capex.groups[g]),
          f.pct(res.capex.groups[g] / res.capex.total * 100, 1)]);
      rows.push(['<b>Итого</b>', '<b>' + f.num(res.capex.total) + '</b>', '<b>100%</b>']);
      rows.push(['Лимит займа', f.num(fd.loanTotal), f.pct(fd.loanShare, 0)]);
      rows.push(['Собственное участие', f.num(fd.equity), f.pct(fd.equityShare, 0)]);
      return rateLine + dt(['Статья', 'Сумма, тыс. ₸', 'Доля'], rows);
    })(),
    pnlTable: (function () {
      const tbl = dt(['Год', 'Выручка', 'Субсидии', 'Затраты', 'EBITDA', 'Маржа'],
        res.pnl.map(y => [y.year, f.num(y.revenue), f.num(y.subsidy), f.num(y.opex + y.operatorFee),
          f.num(y.ebitda), f.pct(y.margin, 0)]));
      /* Резкое падение субсидий роняет маржу на несколько пунктов. Без
         пояснения провал в середине таблицы читается как ошибка расчёта,
         поэтому строку даём на каждый такой год: сноска про конец
         горизонта под таблицей субсидий к конкретному году не привязана. */
      const notes = [];
      for (let i = 1; i < res.pnl.length; i++) {
        if (!(res.pnl[i - 1].subsidy > 0 && res.pnl[i].subsidy < res.pnl[i - 1].subsidy * 0.6)) continue;
        /* Меры, закончившиеся в предыдущем году проекта (yearTo = номер того
           года). Нулевая ставка ничего не приносила и падение объяснить
           не может — такие меры не перечисляем. Названия оставляем как есть:
           в них есть аббревиатуры, и нижний регистр давал «мтф». */
        const ended = state.subsidies.filter(s => s.enabled && s.yearTo === i && s.value > 0);
        const capexEnded = ended.filter(s => s.type === 'capex_pct');
        const names = list => list.map(s => s.name).join('; ');
        const cause = capexEnded.length
          ? 'заканчиваются разовые инвестиционные субсидии (' + names(capexEnded) + ')'
          : ended.length
            ? 'заканчиваются меры поддержки (' + names(ended) + ')'
            : 'сокращается объём государственной поддержки';
        notes.push('<p><i>Снижение маржи в ' + res.pnl[i].year + ' году — ' + cause +
          '. Субсидии падают с ' + f.num(res.pnl[i - 1].subsidy) + ' до ' + f.num(res.pnl[i].subsidy) +
          ' тыс. ₸, маржа с ' + f.pct(res.pnl[i - 1].margin, 0) + ' до ' + f.pct(res.pnl[i].margin, 0) +
          '. Операционные показатели фермы при этом не ухудшаются.</i></p>');
      }
      return notes.length ? tbl + '\n' + notes.join('\n') : tbl;
    })(),
    debtTable: dt(['Год', 'Остаток', 'Проценты', 'Осн. долг', 'Платёж', 'DSCR'],
      res.debt.map((d, i) => [d.year, f.num(d.opening), f.num(d.interest), f.num(d.principal),
        f.num(d.payment), m.dscr[i].value !== null ? m.dscr[i].value.toFixed(2) : '—'])),
    exitTable: dt(['Год выхода', 'MOIC', 'IRR на вложения', 'Стоимость доли, тыс. ₸'],
      m.exits.map(e => [e.year, f.x(e.moic), e.irr !== null ? f.pct(e.irr * 100) : '—', f.num(e.equityValue)])),
    subsidyTable: (function () {
      const on = state.subsidies.filter(s => s.enabled);
      if (!on.length) return '<p><i>Меры государственной поддержки в расчёте не учитывались.</i></p>';
      const tbl = dt(['Мера поддержки', 'Ставка', 'Период'],
        on.map(s => [s.name, f.num(s.value, 1) + ' ' + s.unit,
          'годы ' + s.yearFrom + '–' + s.yearTo]));
      /* Меры могут заканчиваться раньше конца горизонта — тогда последние
         годы посчитаны без поддержки. Это допущение, а не пропуск данных,
         и в документе для кредитора его нужно назвать вслух. */
      const last = Math.max.apply(null, on.map(s => s.yearTo));
      if (last >= p.project.horizon) return tbl;
      const tail = p.project.horizon - last;
      return tbl + '\n<p><i>Меры поддержки заданы по ' + last + '-й год проекта (' +
        (p.project.startYear + last - 1) + ' год). Оставшиеся ' + tail +
        (tail === 1 ? ' год горизонта рассчитан' : ' года горизонта рассчитаны') +
        ' без государственной поддержки: продление программ не закладывалось. ' +
        'Допущение консервативное — если меры продлят, показатели проекта улучшатся.</i></p>';
    })(),
    subsidyComparisonTable: (function () {
      const imp = MTF.subsidyImpact(res);
      if (!imp) return '<p><i>Меры государственной поддержки в расчёте не учитывались, ' +
        'сравнивать не с чем.</i></p>';
      return dt(['Показатель', 'Без субсидий', 'С субсидиями', 'Разница'],
        imp.map(r => {
          const t = f.impact(r);
          return [r.label + (r.unit && r.unit !== '%' ? ', ' + r.unit : ''), t.off, t.on, t.diff];
        }));
    })(),
    consolidatedTable: dt(['Показатель', '1 ферма', N + ' ферм'], [
      ['Стоимость проекта, тыс. ₸', f.num(res.capex.total), f.num(res.capex.total * N)],
      ['Собственное участие, тыс. ₸', f.num(fd.equity), f.num(fd.equity * N)],
      ['Лимит займа, тыс. ₸', f.num(fd.loanTotal), f.num(fd.loanTotal * N)],
      ['NPV, тыс. ₸', f.num(m.npv), f.num(m.npv * N)],
      ['Фуражное поголовье, гол.', f.num(lastH.cows), f.num(lastH.cows * N)],
      ['Валовой надой, т/год', f.num(lastH.milkLiters / 1000), f.num(lastH.milkLiters / 1000 * N)]
    ])
  };
};

MTF.buildDocData = function (state, res) {
  const p = state.params, f = MTF.fmt;
  const cc = p.capacity.cowPlaces + p.capacity.dryPlaces;
  const feeText = p.finance.operatorFeeMode === 'revenue'
    ? p.finance.operatorFeeValue + '% от выручки'
    : p.finance.operatorFeeMode === 'ebitda'
      ? p.finance.operatorFeeValue + '% от EBITDA'
      : f.num(p.finance.operatorFeeValue) + ' тыс. ₸ в год';

  return {
    region: p.project.region || '__________',
    district: p.project.district || '__________',
    operator: p.project.operator || '__________',
    farmsCount: p.project.farmsCount,
    startYear: p.project.startYear,
    endYear: p.project.startYear + p.project.horizon - 1,
    horizon: p.project.horizon,
    capacityCows: f.num(res.herd.meta.target),
    totalCows: f.num(res.herd.meta.target * p.project.farmsCount),
    cowPlaces: p.capacity.cowPlaces, dryPlaces: p.capacity.dryPlaces,
    startHeifers: p.herd.startHeifers, batches: p.herd.batches,
    remontModeText: MTF.remontModeText[p.production.remontMode],
    bullModeText: MTF.bullModeText[p.production.bullMode],
    operatorFeeText: feeText,
    totalAtCapacity: (function () {
      const P = p.production, tgt = res.herd.meta.target;
      const need = tgt * P.cullRate / 100;
      const h = need * (P.firstCalvingMo - P.calfSaleAgeMo) / 12;
      const c = tgt * P.calvingRate / 100 * (1 - P.calfMortality / 100) * P.calfSaleAgeMo / 12;
      return f.num(tgt + h + c);
    })(),
    quarantineDays: p.production.quarantineDays,
    dryDays: p.production.dryDays,
    calvingPenDays: p.production.calvingPenDays,
    calfSaleAge: p.production.calfSaleAgeMo,
    firstCalvingMo: p.production.firstCalvingMo
  };
};

/* Лёгкая разметка: **жирный**, - список */
function mdLite(t) {
  const lines = t.split('\n');
  let out = '', inList = false;
  lines.forEach(l => {
    const s = l.trim();
    if (s.startsWith('<table')) { if (inList) { out += '</ul>'; inList = false; } out += s; return; }
    if (s.startsWith('<p>')) { if (inList) { out += '</ul>'; inList = false; } out += s; return; }
    if (s.startsWith('- ')) {
      if (!inList) { out += '<ul>'; inList = true; }
      out += '<li>' + s.slice(2) + '</li>';
      return;
    }
    if (inList) { out += '</ul>'; inList = false; }
    if (!s) return;
    const b = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    out += (s.startsWith('**') && s.endsWith('**')) ? '<h3>' + b.replace(/<\/?b>/g, '') + '</h3>' : '<p>' + b + '</p>';
  });
  if (inList) out += '</ul>';
  return out;
}

MTF.renderDoc = function (state, res) {
  const data = Object.assign(MTF.buildDocData(state, res), MTF.docTables(state, res));
  let n = 0;
  return state.docSections.filter(s => s.enabled).map(s => {
    let body = s.body;
    Object.keys(data).forEach(k => { body = body.split('{{' + k + '}}').join(data[k]); });
    // разделы с номером перенумеровываются подряд, ненумерованные остаются как есть
    let title = s.title;
    const m = title.match(/^(\d+)\.\s*(.+)$/);
    if (m) {
      n++;
      const old = m[1];
      title = n + '. ' + m[2];
      // подтягиваем номера подпунктов внутри текста: 5.1 → 4.1
      if (String(n) !== old) {
        body = body.replace(new RegExp('\\b' + old + '\\.(\\d+)\\.', 'g'), n + '.$1.');
      }
    }
    return { title: title, body: mdLite(body) };
  });
};

/* Полный HTML документа */
MTF.docHtml = function (state, secs) {
  const p = state.params;
  const d = new Date().toLocaleDateString('ru-RU');
  return '<div class="doc-title">' +
    '<div class="dt-label">Модель проекта</div>' +
    '<h1>' + (p.project.name || 'Молочно-товарная ферма') + '</h1>' +
    '<div class="dt-meta">' +
    (p.project.region ? p.project.region + ' область' : '__________ область') + ' · ' +
    p.project.farmsCount + ' ферм · ' +
    MTF.fmt.num(MTF.lastResult ? MTF.lastResult.herd.meta.target : 0) + ' фуражных коров<br>' +
    (p.project.operator || '__________') + ' · ' + d +
    '</div></div>' +
    secs.map(s => '<section><h2>' + s.title + '</h2>' + s.body + '</section>').join('');
};

/* Строки таблицы продуктивности: выбраковка по годам и схема продажи лишних тёлок */
MTF.docCullRows = function (p, f) {
  const P = p.production;
  const free = P.cullRateFreeYears || 0, low = P.cullRateStartYears || 0;
  const parts = [];
  if (free > 0) parts.push('0% в ' + (free === 1 ? '1-й год' : 'первые ' + f.num(free) + ' г.'));
  if (low > 0) parts.push(f.num(P.cullRateStart) + '% в ' + (free > 0 ? 'следующие ' : 'первые ') + f.num(low) + ' г.');
  parts.push((parts.length ? 'затем ' : '') + f.num(P.cullRate) + '%');
  const rows = [['Выбраковка, % в год', parts.length > 1 ? parts.join(', ') : f.num(P.cullRate)]];
  if (P.remontMode === 'own' && MTF.salePlanOf) {
    rows.push(['Продажа лишних тёлок', MTF.salePlanOf(P).map(function (t) {
      return f.num(t.frac * 100, 0) + '% в ' + f.num(t.age) + ' мес.';
    }).join(', ')]);
  }
  return rows;
};

/* ---------- Раздел «Персонал и оплата труда» ----------
   Показывает три блока ФОТ: что считается на ферму, а что на весь проект. */
(function () {
  const section = {
    id: 'staff', title: '19. Персонал и оплата труда', enabled: false,
    body: `Фонд оплаты труда сформирован тремя блоками. Блок фермы считается на каждую ферму отдельно. Общие блоки обслуживают все фермы проекта, и их стоимость распределяется между фермами поровну.

{{staffBlocksTable}}

{{staffNote}}

**Штатное расписание**

{{staffRosterTable}}`
  };
  const ei = MTF.docSections.findIndex(function (x) { return x.id === 'equipment'; });
  if (ei >= 0) MTF.docSections.splice(ei + 1, 0, section); else MTF.docSections.push(section);

  ['passport', 'bizplan', 'investment'].forEach(function (id) {
    const m = MTF.docModes.find(function (x) { return x.id === id; });
    if (m && m.sections && m.sections.indexOf('staff') < 0) {
      const i = m.sections.indexOf('equipment');
      if (i >= 0) m.sections.splice(i + 1, 0, 'staff'); else m.sections.push('staff');
    }
  });

  const orig = MTF.docTables;
  MTF.docTables = function (state, res) {
    const t = orig(state, res);
    if (!(state.params.project && state.params.project.type === 'feedlot')) {
      const p = state.params, f = MTF.fmt;
      const cows = res.herd && res.herd.meta ? res.herd.meta.target : 0;
      const pr = MTF.calcPayroll(p, state.staff, cows);
      const N = pr.farms || MTF.staffDivisor(p);
      const taxK = 1 + MTF.payrollTaxRate / 100;
      const dash = '—';
      const tbl = function (head, rows) {
        return dt(head, rows);
      };

      t.staffBlocksTable = tbl(
        ['Блок', 'Человек на проект', 'ФОТ на проект, тыс. ₸', 'ФОТ на одну ферму, тыс. ₸'],
        pr.blocks.map(function (b) {
          const filled = b.netTotal > 0;
          const heads = b.scope === 'project' ? b.headcountFull : b.headcountFull * N;
          const how = b.scope === 'project' ? 'на проект, делится на ' + N + ' ферм' : 'на каждую ферму';
          return [b.name + ' (' + how + ')', filled ? f.num(heads, 0) : dash,
            filled ? f.num(b.grossTotal) : dash, filled ? f.num(b.gross) : dash];
        }).concat([[
          '<b>Итого</b>', '', '<b>' + f.num(pr.gross * N) + '</b>', '<b>' + f.num(pr.gross) + '</b>'
        ]]));

      t.staffNote = '<p>Суммы приведены с начислениями на оклады (' + MTF.payrollTaxRate +
        '%), при проектной мощности фермы, в ценах первого года расчёта. В расчёте на одну ферму ' +
        'учтена 1/' + N + ' часть общих блоков. В пересчёте на одну фуражную корову фонд оплаты труда ' +
        'фермы составляет ' + f.num(cows > 0 ? pr.gross / cows : 0, 1) + ' тыс. ₸ в год.</p>';

      const rowsOut = [];
      pr.blocks.forEach(function (b) {
        const list = state.staff.filter(function (s) { return (s.block || 'farm') === b.id && s.count > 0; });
        if (!list.length) return;
        rowsOut.push(['<b>' + b.name + '</b>', '', '', '']);
        list.forEach(function (s) {
          rowsOut.push([s.name, f.num(s.count), f.num(s.salary), f.num(s.count * s.salary * 12 * taxK)]);
        });
      });
      t.staffRosterTable = rowsOut.length
        ? tbl(['Должность', 'Количество', 'Оклад на руки, тыс. ₸ в мес.', 'В год с начислениями, тыс. ₸'], rowsOut)
        : '<p><i>Штатное расписание уточняется.</i></p>';
    } else {
      t.staffBlocksTable = ''; t.staffNote = ''; t.staffRosterTable = '';
    }
    return t;
  };
})();
