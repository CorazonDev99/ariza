import type { Dict } from '../index';

export const uz_cyrillic: Dict = {
  // common
  'cmd.start.greeting': '👋 Ассалому алайкум, <b>{name}</b>!\n\n📄 Бу бот суд учун расмий аризаларни 1 дақиқада тайёрлаб беради — босма шаклда, имзо ва санага тайёр.\n\n🧭 <b>Қандай ишлайди:</b>\n1️⃣ Суд турини танланг (ҳозирча — фуқаролик)\n2️⃣ Вилоят ва туманлараро судни танланг\n3️⃣ Ариза турини танланг\n4️⃣ Бир нечта саволга жавоб беринг — тайёр!\n\n🎙 Исм, манзил ва бошқа эркин майдонларни <b>овозли хабар</b> билан ҳам юборсангиз бўлади — бот ўзи матнга айлантиради.\n\n📖 Биринчи марта фойдаланяпсизми? <b>Қўлланма</b> бўлимини очинг — ҳар бир ариза қачон, қаерга ва қандай топширилиши тушунтирилган.\n\nБошлаш учун менюдан танланг 👇',
  'cmd.about': '<b>ℹ️ Бот ҳақида</b>\n\nУшбу бот суд аризаларини автоматик равишда тайёрлайди. Сиз фақат маълумотларингизни киритасиз, бот эса тайёр PDF ҳужжатни юборади — <b>бепул</b>.\n\n<b>📄 Тайёрланадиган аризалар:</b>\n• Алимент ундириш\n• 3 ёшгача таъминот ундириш\n• Эътирознома\n• Алимент миқдорини камайтириш\n\n<b>🛠 Қандай фойдаланиш:</b>\n1️⃣ «📄 Ариза топшириш» тугмасини босинг\n2️⃣ Суд тури → вилоят → туманлараро суд → ариза турини танланг\n3️⃣ Саволларга жавоб беринг (овозли хабар ҳам қабул қилинади 🎙)\n4️⃣ Маълумотларни текширинг ва тасдиқланг\n5️⃣ Тайёр PDF ҳужжатни юклаб олинг\n\n<b>⌨️ Командалар:</b>\n/start — менюга қайтиш\n/new — янги ҳужжат\n/guide — аризалар бўйича қўлланма\n/lang — тилни ўзгартириш\n/cancel — жараённи бекор қилиш\n/about — ушбу маълумот\n\nСавол ёки таклифлар учун қуйидаги тугма орқали биз билан боғланинг 👇',
  'about.support_btn': '💬 Қўллаб-қувватлаш',
  'about.no_contact': 'ℹ️ Қўллаб-қувватлаш контакти ҳозирча мавжуд эмас.',
  'about.stats':
    '⭐️ <b>Бизга ишонишади:</b>\n📄 {docs} та ариза тайёрланди\n👥 {users} та фойдаланувчи',
  'cmd.cancelled': '❌ Бекор қилинди.',
  'cmd.session.expired': '⌛ Сессия тугаган. /new ёрқали қайта бошланг.',

  // language
  'lang.pick': '🌐 <b>Тилни танланг / Tilni tanlang / Выберите язык</b>',
  'lang.changed': '✅ Тил сақланди: <b>{lang}</b>',

  // main menu
  'menu.new': '📄 Ариза топшириш',
  'menu.instructions': '📖 Қўлланма',
  'menu.jadval': '📋 Ишимни текшириш',
  'menu.about': 'ℹ️ Бот ҳақида',
  'menu.lang': '🌐 Тил',

  // jadval2 case-schedule lookup flow
  'jadval.type.pick': '📋 <b>Иш турини танланг:</b>',
  'jadval.region.pick': '🏛️ <b>Ҳудудни танланг:</b>',
  'jadval.court.pick': '⚖️ <b>{region}</b>\n\nСудни танланг:',
  'jadval.loading': '⏳ jadval2.sud.uz дан маълумотлар юкланмоқда...',
  'jadval.empty': '📭 <b>{court}</b>\n📅 {date}\n\nУшбу санага суд мажлисига тайинланган ишлар йўқ.',
  'jadval.error': '⚠️ jadval2.sud.uz дан маълумотларни олиб бўлмади. Бироздан кейин қайта уриниб кўринг.',
  'jadval.header': '📋 <b>{court}</b>\n📅 {date}\n\nЖами: <b>{count}</b> та иш',
  'jadval.more': '\n\n<i>… яна {n} та иш. Тўлиқ рўйхат — <a href="https://jadval2.sud.uz">jadval2.sud.uz</a></i>',
  'jadval.back-types': '⬅️ Иш турлари',
  'jadval.back-regions': '⬅️ Ҳудудлар',
  'jadval.cmd.desc': '📋 Иш бўйича жадвал',
  'jadval.date.pick': '📅 <b>{court}</b>\n\nСанани танланг:',
  'jadval.btn.search': '🔍 Қидириш',
  'jadval.btn.date': '📅 Бошқа сана',
  'jadval.btn.all': '📋 Барчасини кўрсатиш',
  'jadval.btn.cancel-search': '❌ Бекор қилиш',
  'jadval.search.prompt': '🔍 <b>Қидириш</b>\n\nФ.И.Ш. ёки иш рақамининг бир қисмини юборинг (масалан: <code>KIRGIZBOYEV</code> ёки <code>2-1701-2608</code>):',
  'jadval.search.cancelled': '❌ Қидириш бекор қилинди.',
  'jadval.search.header': '🔍 <b>«{query}»</b> бўйича топилди: <b>{matched}</b> / {total}\n📋 <b>{court}</b> · 📅 {date}',
  'jadval.search.empty': '🔍 <b>«{query}»</b> бўйича ҳеч нарса топилмади.\n\n📋 <b>{court}</b> · 📅 {date}\nЖами рўйхатда: {total} та иш',

  // /-menu descriptions (Telegram client shows next to command name)
  'cmd.new.desc': 'Янги ариза тайёрлаш',
  'cmd.guide.desc': 'Аризалар бўйича қўлланма',
  'cmd.lang.desc': 'Тилни ўзгартириш',
  'cmd.about.desc': 'Бот ҳақида ва қўллаб-қувватлаш',
  'cmd.cancel.desc': 'Жараённи бекор қилиш',
  'cmd.start.desc': 'Менюга қайтиш',
  'cmd.admin.desc': '🛠 Админ панели',
  'cmd.broadcast.desc': '📣 Барча фойдаланувчиларга хабар',

  // wizard buttons
  'btn.back': '⬅️ Орқага',
  'btn.cancel': '❌ Бекор қилиш',
  'btn.confirm': '✅ Тасдиқлаш',
  'btn.edit': '✏️ Қайта таҳрирлаш',
  'btn.pay': '💳 {amount} сўм тўлаш',
  'btn.skip': '⏭️ Ўтказиш',

  // templates
  'tmpl.pick': '📄 <b>Ариза турини танланг:</b>',
  'tmpl.back': '⬅️ Судлар',

  // instructions / guide flow
  'instructions.pick': '📖 <b>Қўлланма</b>\n\nБатафсил маълумот учун ариза турини танланг:',
  'instructions.start_btn': '▶️ Тайёрлашни бошлаш',
  'instructions.back_btn': '⬅️ Аризалар рўйхати',
  'tmpl.chosen': '✅ <b>Шаблон:</b> {title}\n<i>{subtitle}</i>',
  'tmpl.not-in-db': '⚠️ Шаблон БД да рўйхатдан ўтмаган. Бот қайта ишга туширилаётганини кутинг.',

  // court type picker
  'court-type.pick': '🏛️ <b>Суд турини танланг:</b>',
  'court-type.chosen': '✅ <b>Суд тури:</b> {type}',
  'court-type.coming-soon': '🚧 Бу йўналиш бўйича аризалар ҳозирча мавжуд эмас. Тез орада қўшамиз.',

  // region picker
  'region.pick': '🏛️ <b>Суд жойлашган ҳудудни танланг:</b>',
  'region.back': '⬅️ Суд турлари',
  'region.chosen': '✅ <b>Ҳудуд:</b> {region}',

  // district court picker
  'district.pick': '⚖️ <b>{region}</b>\n\nСудни танланг:',
  'district.back': '⬅️ Ҳудудлар',
  'district.chosen': '✅ <b>Суд:</b> {court}',

  // wizard flow
  'wiz.intro': '📝 <b>Маълумотларни тўлдиринг</b>\n\n⬅️ <i>Орқага</i> — олдинги савол\n❌ <i>Бекор қилиш</i> — сессияни ёпиш',
  'wiz.progress': '📊 {bar} {current}/{total}',
  'wiz.use-default': '💡 Тахмин сифатида юклаш учун «-» юборинг',
  'wiz.empty': '⚠️ Бўш қиймат қабул қилинмайди. Қайта киритинг.',
  'wiz.at-start': '⬅️ Сиз бошидасиз — орқага қайтиш мумкин эмас.',
  'wiz.preview.title': '🧾 <b>Маълумотларни текширинг</b>',
  'wiz.preview.confirm-hint': '👇 Ҳаммаси тўғрими?',
  'wiz.use-buttons': '👆 Тугмалардан фойдаланинг.',

  // voice → text on free-form fields
  'wiz.voice.hint': '🎙️ Ёки овозли хабар юборинг — биз матнга айлантирамиз',
  'wiz.voice.processing': '🎙️ Овоз матнга айлантирилмоқда...',
  'wiz.voice.transcribed': '🎙️ <b>Эшитилган матн:</b>\n<i>{text}</i>',
  'wiz.voice.failed': '⚠️ Овозни матнга айлантириб бўлмади. Қайтадан уриниб кўринг ёки матн ёзинг.',
  'wiz.voice.too-long': '⚠️ Овозли хабар жуда узун. Қисқароқ қилиб қайта юборинг.',
  'wiz.voice.not-supported-field': '🎙️ Овоз бу майдонга мос эмас. Илтимос, матн ёзинг.',
  'wiz.voice.disabled': '🎙️ Овозни матнга айлантириш функцияси ҳозирча ёқилмаган. Матн ёзинг.',

  // validation
  'val.fail': '⚠️ <b>Нотўғри қиймат</b>\n{reason}\n\nҚайта киритинг 👇',
  'val.text': 'Камида 2 та белги бўлиши керак.',
  'val.fio': 'Ф.И.Ш. камида 5 та белги ва фақат ҳарфлардан иборат бўлиши керак.',
  'val.phone': 'Телефон формат: +998XXXXXXXXX (12 рақам).',
  'val.money': 'Фақат рақамлар, нуқта/вергул ва бўшлиқлар. Масалан: 1.063.445,21',
  'val.number': 'Фақат бутун сон. Масалан: 3',
  'val.year': '4 хонали йил. Масалан: 2025',
  'val.day': '1 дан 31 гача бутун сон.',
  'val.month': 'Ой номини ёзинг: январ, феврал, март...',
  'val.date': 'Сана формати: 12.05.2015 ёки 2015 йил 12 май',
  'val.year-month': 'Йил ва ой формати: январ 2024 ёки 01.2024',
  'val.share': 'Улуш формати: 1/4, 1/3, 2/3',
  'val.address': 'Манзил камида 10 та белгидан иборат бўлсин.',
  'val.order-number': 'Суд буйруғи рақами формат: 2-1301-2506/20479',
  'val.stir': 'СТИР — 9 та рақамдан иборат бўлиши керак (масалан: 201 988 537)',
  'val.pinfl': 'ЖШШИР — 14 та рақамдан иборат бўлиши керак (масалан: 31008911831636)',
  'val.choice': 'Фақат 1 ёки 2 рақамини юборинг',

  // preview / format
  'preview.confirm': '✅ Маъқуллайман',
  'preview.edit': '✏️ Қайтадан',
  'preview.cancel': '❌ Бекор қилиш',

  // payment
  'pay.pick-provider': '💳 <b>Тўлов</b>\n\nҲужжатни шакллантириш учун <b>{amount} сўм</b> тўлаш керак.\n\nТўлов тизимини танланг:',
  'pay.intro': '💳 <b>Тўлов</b>\n\nҲужжатни шакллантириш учун <b>{amount} сўм</b> тўлаш керак.\n\nТўлов тизими: <b>{provider}</b>\n\nҚуйидаги тугмани босиб тўловни амалга оширинг. Тўловдан кейин «Тўловни текшириш» тугмасини босинг.',
  'pay.waiting': '⏳ Тўловни кутмоқдамиз...',
  'pay.success': '✅ <b>Тўлов қабул қилинди!</b>\n\nЭнди форматни танланг 👇',
  'pay.failed': '❌ Тўлов амалга ошмади. /new орқали қайта уриниб кўринг.',
  'pay.check': '🔍 Тўловни текшириш',
  'pay.not-yet': '⏳ Тўлов ҳали қабул қилинмаган. Тугма орқали тўловни якунланг.',
  'pay.cancelled': '❌ Тўлов бекор қилинди.',
  'pay.btn.click': '🔵 Click UZ',
  'pay.btn.payme': '🟢 Payme',

  // date picker
  'dp.year.pick': '📅 Йилни танланг:',
  'dp.month.pick': '📅 <b>{year}</b> — ойни танланг:',
  'dp.day.pick': '📅 <b>{month} {year}</b> — кунни танланг:',
  'dp.prev': '🆕 Янги',
  'dp.next': '🕰 Эски',
  'month.1': 'январ',
  'month.2': 'феврал',
  'month.3': 'март',
  'month.4': 'апрел',
  'month.5': 'май',
  'month.6': 'июн',
  'month.7': 'июл',
  'month.8': 'август',
  'month.9': 'сентябр',
  'month.10': 'октябр',
  'month.11': 'ноябр',
  'month.12': 'декабр',

  // AI-assist for free-form (multiline) fields
  'ai.offer':
    '🧾 <b>Сиз ёзган матн:</b>\n\n<i>{text}</i>\n\n✨ Хоҳласангиз матнни AI ёрдамида расмий-юридик услубда қайта ёзаман.',
  'ai.working': '🤖 AI матнни қайта ёзмоқда...',
  'ai.result':
    '🤖 <b>AI таклиф этади:</b>\n\n{text}\n\n👇 Қайси вариантни сақлайман?',
  'ai.error':
    '⚠️ AI вақтинча мавжуд эмас. Сиз ўз матнингизни сақлашингиз ёки қайта уриниб кўришингиз мумкин.',
  'ai.btn.improve': '✨ AI билан яхшилаш',
  'ai.btn.keep': '✅ Шу ҳолатида сақлаш',
  'ai.btn.accept': '✅ Шу вариантни сақлаш',
  'ai.btn.retry': '🔁 Яна уриниш',
  'ai.btn.original': '✏️ Менинг матним',

  // FIO prefill from Telegram profile
  'prefill.fio.btn': '📋 {name}',
  'prefill.fio.hint':
    '💡 Тугмани босиб Telegram профилидан Ф.И.Ш.ни ишлатинг, ёки тагида қўлда ёзиб юборинг.',

  // calendar (month-view) picker
  'cal.prompt': '📅 <b>Санани танланг:</b>',
  'choice.prompt': '👇 <b>Танланг:</b>',
  'cal.year.prompt': '📅 Йилни танланг ({month}):',
  'cal.wd.1': 'Дш',
  'cal.wd.2': 'Сш',
  'cal.wd.3': 'Чш',
  'cal.wd.4': 'Пш',
  'cal.wd.5': 'Жм',
  'cal.wd.6': 'Шн',
  'cal.wd.7': 'Як',

  'bot.short_description':
    '⚖️ Ўзбекистон учун 60 сонияда тайёр суд аризалари. Алимент, эътирознома, камайтириш.',
  'bot.description':
    '⚖️ Ўзбекистон қонунчилиги бўйича тайёр суд аризалари.\n\n📄 Ариза турлари:\n• Алимент ундириш\n• 3 ёшгача таъминот\n• Эътирознома (суд буйруғини бекор қилиш)\n• Алимент миқдорини камайтириш\n\n✨ Саволларга жавоб беринг — 60 сонияда тайёр PDF олинг.\n\n{price_line}\n🌐 Кирилл / Lotin / Русский\n\n👇 «START» тугмасини босинг',
  'bot.price_line.paid': '💳 Бир ҳужжат: {amount} сўм',
  'bot.price_line.free': '🎁 Ҳозирча — БЕПУЛ',

  // generation
  'doc.generating': '⏳ Ҳужжат тайёрланмоқда...',
  'doc.ready': '✅ <b>Ҳужжат тайёр!</b>',
  'doc.error': '⚠️ <b>Хатолик:</b> {error}',
  'doc.qr.caption': '📱 <b>QR-код</b>\nҲужжатни юклаб олиш учун скан қилинг.\n\n🔗 <code>{url}</code>',

  // mydocs
  'docs.empty': '📭 Сизда ҳозирча ҳужжатлар йўқ.',
  'docs.title': '📁 <b>Сўнгги ҳужжатлар:</b>',
  'docs.missing': '⚠️ {n} та файл сервердан ўчирилган. Уларни қайта яратишингиз мумкин.',

  // admin panel
  'admin.denied': '⛔️ Сизда админ панелига рухсат йўқ.',
  'admin.menu': '🛠 <b>Админ панель</b>\n\nКеракли бўлимни танланг 👇',
  'admin.closed': '✅ Админ панель ёпилди.',
  'admin.btn.stats': '📊 Статистика',
  'admin.btn.payments': '💰 Тўловлар',
  'admin.btn.broadcast': '📨 Хабар тарқатиш',
  'admin.btn.close': '❌ Ёпиш',
  'admin.btn.back': '⬅️ Орқага',
  'admin.period.day': 'Бугун',
  'admin.period.week': 'Ҳафта',
  'admin.period.month': 'Ой',
  'admin.period.all': 'Бутун давр',
  'admin.range.all': 'Бутун давр',
  'admin.stats.title': '📊 <b>Статистика — {period}</b>',
  'admin.stats.new_users': '👥 Янги фойдаланувчилар: <b>{n}</b>',
  'admin.stats.documents': '📄 Тайёрланган ҳужжатлар: <b>{n}</b>',
  'admin.stats.payments_header': '💰 Тўловлар',
  'admin.stats.paid': '✅ Тўланган: <b>{count}</b> · <b>{sum}</b> сўм',
  'admin.stats.pending': '⏳ Кутилмоқда: {n}',
  'admin.stats.failed': '❌ Хатолик: {n}',
  'admin.stats.cancelled': '🚫 Бекор қилинган: {n}',
  'admin.stats.top_templates': '📑 Энг кўп танланган шаблонлар',
  'admin.stats.by_language': '🌐 Тиллар бўйича',
  'admin.payments.title': '💰 <b>Тўловлар — {period}</b> ({count})',
  'admin.payments.empty': 'Ушбу даврда тўловлар йўқ.',

  'admin.payments.pick': '💰 <b>Тўловлар бўйича ҳисобот</b>\n\nДаврни танланг — Excel файл юбораман:',
  'admin.payments.generating': '⏳ Ҳисобот тайёрланмоқда...',
  'admin.payments.report.caption': '💰 <b>Тўловлар ҳисоботи — {period}</b>\n\n📊 Ёзувлар: <b>{count}</b>\n✅ Тўланган: <b>{sum}</b> сўм',
  'admin.payments.report.error': '⚠️ Ҳисобот яратишда хатолик: {error}',

  'xlsx.col.createdAt': 'Яратилган',
  'xlsx.col.paidAt': 'Тўланган',
  'xlsx.col.status': 'Ҳолат',
  'xlsx.col.provider': 'Провайдер',
  'xlsx.col.amount': 'Миқдор',
  'xlsx.col.merchantTransId': 'Merchant Trans ID',
  'xlsx.col.providerTransId': 'Provider Trans ID',
  'xlsx.col.userId': 'User ID',
  'xlsx.col.telegramId': 'Telegram ID',
  'xlsx.col.username': 'Username',
  'xlsx.col.firstName': 'Исм',
  'xlsx.col.lastName': 'Фамилия',
  'xlsx.status.paid': 'Тўланган',
  'xlsx.status.pending': 'Кутилмоқда',
  'xlsx.status.failed': 'Хатолик',
  'xlsx.status.cancelled': 'Бекор қилинган',
  'admin.bc.prompt': '📨 <b>Хабар тарқатиш</b>\n\nФойдаланувчилар сони: <b>{count}</b>\n\nЮбормоқчи бўлган хабарингизни шу ерга жўнатинг (матн ёки расм + изоҳ).',
  'admin.bc.use_buttons': '👆 Тугмалардан фойдаланинг.',
  'admin.bc.preview_header': '🧾 <b>Олдиндан кўриш</b> · {count} фойдаланувчи',
  'admin.bc.confirm_q': '👇 Тарқатишни тасдиқлайсизми?',
  'admin.bc.send': '✅ Юбориш',
  'admin.bc.redo': '✏️ Қайтадан',
  'admin.bc.cancel': '❌ Бекор қилиш',
  'admin.bc.cancelled': '❌ Тарқатиш бекор қилинди.',
  'admin.bc.send_again': 'Янги хабарни жўнатинг.',
  'admin.bc.starting': '🚀 Тарқатиш бошланди...',
  'admin.bc.progress': '🚀 Юборилмоқда: {sent}/{total} · ❌ {failed}',
  'admin.bc.done': '✅ <b>Тарқатиш якунланди</b>\n\n📤 Юборилди: {sent}/{total}\n❌ Хатолик: {failed}\n⏱ Вақт: {seconds} сония',
  'admin.bc.error': '⚠️ <b>Тарқатиш хатоси:</b> {error}',
};
