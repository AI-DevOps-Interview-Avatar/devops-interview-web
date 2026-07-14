export interface JobResourceItem {
  name: string
  ua: string
  en: string
}

export interface JobResourceCategory {
  id: string
  titleUa: string
  titleEn: string
  items: JobResourceItem[]
}

/** Static curated list — no external links generated, just resource names + short notes. */
export const JOB_RESOURCE_CATEGORIES: JobResourceCategory[] = [
  {
    id: 'ukraine',
    titleUa: 'Україна',
    titleEn: 'Ukraine',
    items: [
      { name: 'DOU.ua', ua: 'Найбільший ресурс для пошуку роботи в IT-сфері.', en: 'The largest job-search resource for the IT field.' },
      { name: 'Djinni.co', ua: 'Домінуюча "анонімна" платформа найму для tech-ринку України.', en: 'The dominant "anonymous" recruitment platform for the Ukrainian tech market.' },
      { name: 'Державний центр зайнятості', ua: 'Багато вакансій для робочих спеціальностей та освіти.', en: "State Employment Center — many vacancies for trade and education professionals." },
      { name: 'Work.ua', ua: 'Найбільший сайт пошуку роботи в Україні, є розділ для студентів.', en: "Ukraine's largest job-search site, with a dedicated student section." },
      { name: 'Robota.ua', ua: 'Другий найбільший ресурс, є розділ популярних професій.', en: 'Second-largest resource, with a popular-professions section.' },
      { name: 'Grc.ua', ua: 'Близько 4000 вакансій, є розділ віддаленої роботи.', en: 'About 4,000 listings, with a remote-work section.' },
      { name: 'Jooble', ua: 'Категорії "позмінно", "щоденна оплата", "віддалена робота".', en: 'Categories for shift work, daily pay, and remote work.' },
      { name: 'Happy Monday', ua: 'Вакансії від українських та зарубіжних роботодавців.', en: 'Listings from Ukrainian and foreign employers.' },
      { name: 'Upwork', ua: 'Один із найпопулярніших міжнародних сайтів для фрілансерів.', en: 'One of the most popular international freelance platforms.' },
      { name: 'Fiverr', ua: 'Міжнародний сайт для представників творчих професій.', en: 'International platform for creative professionals.' },
    ],
  },
  {
    id: 'telegram-ukraine',
    titleUa: 'Телеграм-канали (Україна)',
    titleEn: 'Telegram channels (Ukraine)',
    items: [
      { name: 'Goodjob', ua: 'Вакансії, поради, навчальні програми для українців.', en: 'Vacancies, tips, and training programs for Ukrainians.' },
      { name: 'UaJobNow', ua: 'Вакансії в Україні, за кордоном та віддалено.', en: 'Vacancies in Ukraine, abroad, and remote.' },
      { name: 'Lobby X', ua: 'Робота в Україні, окремий канал для IT.', en: 'Jobs in Ukraine, with a dedicated IT channel.' },
      { name: 'Робота зараз: Україна', ua: 'Виключно українські вакансії.', en: 'Ukrainian vacancies only.' },
      { name: 'Крезюме Вакансії', ua: 'IT та творчі професії.', en: 'IT and creative professions.' },
      { name: 'DeХто | Відстань', ua: 'Віддалена робота, є канали по містах (Київ, Львів, Харків, Одеса, Дніпро).', en: 'Remote work, with per-city channels (Kyiv, Lviv, Kharkiv, Odesa, Dnipro).' },
      { name: 'Remote job', ua: 'Англомовний канал з вакансіями з усього світу.', en: 'English-language channel with vacancies from around the world.' },
    ],
  },
  {
    id: 'global',
    titleUa: 'Глобальні лідери',
    titleEn: 'Global leaders',
    items: [
      { name: 'LinkedIn', ua: 'Платформа №1 за обсягом вакансій та нетворкінгом.', en: 'The #1 platform by listing volume and networking.' },
      { name: 'Indeed', ua: 'Величезний агрегатор вакансій, найкраще для США/ЄС.', en: 'A huge job aggregator, best for the US/EU.' },
      { name: 'Google Jobs', ua: 'Вбудований пошуковик Google, веде на сторінки кар’єри компаній.', en: "Google's built-in job search, links directly to company career pages." },
    ],
  },
  {
    id: 'europe',
    titleUa: 'Європа',
    titleEn: 'Europe',
    items: [
      { name: 'Landing.Jobs', ua: 'Tech-ринок Європи (Португалія, Іспанія, Німеччина), допомога з релокацією.', en: 'European tech market (Portugal, Spain, Germany), relocation help.' },
      { name: 'Otta', ua: 'Топові стартапи Лондона, Берліна, Амстердама, фільтри за культурою.', en: 'Top startups in London, Berlin, Amsterdam, with culture filters.' },
      { name: 'Honey Pot', ua: 'Платформа зворотного найму, популярна в Німеччині/Австрії.', en: 'Reverse-recruiting platform, popular in Germany/Austria.' },
      { name: 'Malt', ua: 'Фріланс/контрактна робота (Франція, Іспанія).', en: 'Freelance/contract work (France, Spain).' },
      { name: 'Pracuj.pl', ua: 'Найбільша платформа пошуку роботи в Польщі.', en: 'The largest job-search platform in Poland.' },
    ],
  },
  {
    id: 'usa',
    titleUa: 'США',
    titleEn: 'United States',
    items: [
      { name: 'Dice', ua: 'Спеціалізований сайт для IT (сисадміни, DevOps, SRE).', en: 'IT-specialized site (sysadmins, DevOps, SRE).' },
      { name: 'Wellfound', ua: 'Роботи в американських стартапах, часто з опціонами.', en: 'Jobs at US startups, often with equity options.' },
      { name: 'Built In', ua: 'Великі тех-хаби США (SF, Остін, Чикаго, Нью-Йорк).', en: 'Major US tech hubs (SF, Austin, Chicago, NYC).' },
    ],
  },
  {
    id: 'remote',
    titleUa: 'Віддалена робота (Remote-first)',
    titleEn: 'Remote-first',
    items: [
      { name: 'We Work Remotely', ua: 'Найстаріша та найбільш довірена remote-спільнота.', en: 'The oldest and most trusted remote-work community.' },
      { name: 'Remote OK', ua: 'Велика кількість вакансій для розробників та інженерів.', en: 'A large volume of listings for developers and engineers.' },
      { name: 'Remotive', ua: 'Перевірені (vetted) вакансії, менше спаму.', en: 'Vetted listings, less spam.' },
      { name: 'FlexJobs', ua: 'Платна підписка, гарантія відсутності шахрайства.', en: 'Paid subscription, scam-free guarantee.' },
    ],
  },
  {
    id: 'testing',
    titleUa: 'Фріланс-тестування (Crowdsourced Testing)',
    titleEn: 'Freelance testing (crowdsourced)',
    items: [
      { name: 'uTest', ua: 'Найбільша платформа, є навчання (Academy).', en: 'The largest platform, includes a training Academy.' },
      { name: 'Test IO', ua: 'Тестування мобільних додатків/сайтів відомих брендів (Європа).', en: "Testing mobile apps/sites for well-known brands (Europe)." },
      { name: 'UserTesting', ua: 'Оплата за відгуки про зручність використання (Usability).', en: 'Paid usability-testing feedback.' },
    ],
  },
]

export const JOB_SEARCH_TIPS: { ua: string; en: string }[] = [
  {
    ua: 'Для США та Європи адаптуйте резюме під ATS: без фото, графіків і складного дизайну.',
    en: 'For the US and Europe, adapt your resume for ATS: no photo, charts, or complex design.',
  },
  {
    ua: 'Verified-статус (Arc.dev, Toptal) підвищує увагу до профілю у 5–10 разів.',
    en: 'A "Verified" status (Arc.dev, Toptal) increases profile attention 5–10x.',
  },
  {
    ua: 'Для конкретної країни шукайте локальні ресурси (напр. Reed.co.uk для Британії).',
    en: 'For a specific country, look for local resources (e.g. Reed.co.uk for the UK).',
  },
  {
    ua: 'Не забувайте про групи в соціальних мережах, присвячені пошуку роботи у вашому місті.',
    en: "Don't forget local social-media groups dedicated to job search in your city.",
  },
]
