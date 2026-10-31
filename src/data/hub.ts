// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · CRYPTO HUB DATA
// Актуально на 1 ноября 2026 года (ориентировано на РФ)
// ═══════════════════════════════════════════════════════════════

export interface HubText {
  ru: string;
  en: string;
}

export interface HubItem {
  name: string;
  desc: HubText;
  url: string;
  status: 'ru' | 'vpn' | 'no' | 'global';
  icon: string;
  details: {
    access: HubText;
    kyc: HubText;
    p2p: HubText;
    fees: string;
    pros: HubText[];
    cons: HubText[];
    summary: HubText;
  };
}

export const HUB_DATA: Record<string, HubItem[]> = {
  exchanges: [
    {
      name: 'Bybit',
      desc: { ru: 'Лидер для СНГ', en: 'Leader for CIS' },
      url: 'https://www.bybit.com',
      status: 'ru',
      icon: 'B',
      details: {
        access: { ru: 'Работает без VPN', en: 'Works without VPN' },
        kyc: { ru: 'Обязательна (паспорт РФ)', en: 'Required (RU passport)' },
        p2p: { ru: 'Есть (СБП, Сбер, Т-Банк) — самый живой рынок', en: 'Yes (SBP, Sber, T-Bank) — most active market' },
        fees: '0.1% / 0.18%',
        pros: [
          { ru: 'Самая живая P2P-площадка в рублях (около 1500 активных предложений)', en: 'Most active P2P market in RUB (~1500 active offers)' },
          { ru: 'Глубокая ликвидность и фьючерсы', en: 'Deep liquidity and futures' },
          { ru: 'Русский интерфейс и поддержка', en: 'Russian interface and support' },
          { ru: 'Доступна криптокарта для платежей', en: 'Crypto card available for payments' }
        ],
        cons: [
          { ru: 'Жёсткий комплаенс (блокировки за подозрительные транзакции)', en: 'Strict compliance (blocks for suspicious transactions)' },
          { ru: 'Нет прямого пополнения через СБП (только P2P)', en: 'No direct deposit via SBP (P2P only)' }
        ],
        summary: { 
          ru: 'Оптимальный выбор для повседневной торговли и ввода рублей с карты. Рекомендуется как основная биржа для россиян.', 
          en: 'Optimal choice for daily trading and RUB deposits from a card. Recommended as the primary exchange for Russians.' 
        }
      }
    },
    {
      name: 'BingX',
      desc: { ru: 'Копитрейдинг и P2P', en: 'Copy trading and P2P' },
      url: 'https://bingx.com',
      status: 'ru',
      icon: 'B',
      details: {
        access: { ru: 'Работает без VPN', en: 'Works without VPN' },
        kyc: { ru: 'Не обязательна для малых сумм (P2P без верификации)', en: 'Not required for small amounts (P2P without verification)' },
        p2p: { ru: 'Есть (СБП, Т-Банк, ЮMoney)', en: 'Yes (SBP, T-Bank, YooMoney)' },
        fees: '0.1% / 0.1%',
        pros: [
          { ru: 'Лучший копитрейдинг на рынке (тысячи мастер-трейдеров)', en: 'Best copy trading on the market (thousands of master traders)' },
          { ru: 'P2P без верификации на небольшие суммы', en: 'P2P without verification for small amounts' },
          { ru: 'Бонусы новичкам до 5000 USDT', en: 'Bonuses for beginners up to 5000 USDT' },
          { ru: 'Простой интерфейс для новичков', en: 'Simple interface for beginners' }
        ],
        cons: [
          { ru: 'Меньше ликвидности, чем на Bybit', en: 'Less liquidity than Bybit' },
          { ru: 'Иногда высокие спреды на P2P', en: 'Sometimes high spreads on P2P' }
        ],
        summary: { 
          ru: 'Отличный вариант для новичков и тех, кто хочет копировать сделки опытных трейдеров. P2P доступен без KYC на малые суммы.', 
          en: 'Great option for beginners and those who want to copy trades of experienced traders. P2P is available without KYC for small amounts.' 
        }
      }
    },
    {
      name: 'OKX',
      desc: { ru: 'Web3 и низкие комиссии', en: 'Web3 and low fees' },
      url: 'https://www.okx.com',
      status: 'ru',
      icon: 'O',
      details: {
        access: { ru: 'Работает без VPN', en: 'Works without VPN' },
        kyc: { ru: 'Обязательна (паспорт РФ)', en: 'Required (RU passport)' },
        p2p: { ru: 'Нет рублёвого P2P (только крипто-депозиты)', en: 'No RUB P2P (crypto deposits only)' },
        fees: '0.08% / 0.1%',
        pros: [
          { ru: 'Одни из самых низких комиссий на рынке', en: 'One of the lowest fees on the market' },
          { ru: 'Мощный Web3-кошелёк', en: 'Powerful Web3 wallet' },
          { ru: 'Качественное исполнение ордеров', en: 'High-quality order execution' }
        ],
        cons: [
          { ru: 'Нет рублёвого P2P (вводить рубли только через посредников)', en: 'No RUB P2P (deposit RUB only via intermediaries)' },
          { ru: 'Строгий санкционный комплаенс', en: 'Strict sanctions compliance' }
        ],
        summary: { 
          ru: 'Для опытных трейдеров, которым важны низкие комиссии и Web3, и которые готовы заводить средства через крипту.', 
          en: 'For experienced traders who value low fees and Web3, and who are ready to deposit funds via crypto.' 
        }
      }
    },
    {
      name: 'Gate.io',
      desc: { ru: 'Огромный выбор альткоинов', en: 'Huge altcoin selection' },
      url: 'https://www.gate.io',
      status: 'ru',
      icon: 'G',
      details: {
        access: { ru: 'Работает без VPN', en: 'Works without VPN' },
        kyc: { ru: 'Обязательна', en: 'Required' },
        p2p: { ru: 'Есть, но ограничен (P2P RUB работает)', en: 'Yes, but limited (P2P RUB works)' },
        fees: '0.1% / 0.1%',
        pros: [
          { ru: 'Тысячи малоизвестных монет', en: 'Thousands of lesser-known coins' },
          { ru: 'Быстрые листинги новинок', en: 'Fast listings of new coins' },
          { ru: 'Низкий порог входа', en: 'Low entry threshold' }
        ],
        cons: [
          { ru: 'Высокий риск нарваться на скам-монету', en: 'High risk of running into a scam coin' },
          { ru: 'Меньшая ликвидность по сравнению с топ-3', en: 'Lower liquidity compared to top 3' }
        ],
        summary: { 
          ru: 'Идеально для охоты за новыми альткоинами, но требует осторожности и проверки проектов.', 
          en: 'Ideal for hunting new altcoins, but requires caution and project research.' 
        }
      }
    },
    {
      name: 'Rapira',
      desc: { ru: 'Биржа для СНГ', en: 'Exchange for CIS' },
      url: 'https://rapira.exchange',
      status: 'ru',
      icon: 'R',
      details: {
        access: { ru: 'Работает без VPN', en: 'Works without VPN' },
        kyc: { ru: 'Для полноценного доступа требуется верификация', en: 'Verification required for full access' },
        p2p: { ru: 'Есть (рубли, СБП)', en: 'Yes (RUB, SBP)' },
        fees: 'Зависит от пары',
        pros: [
          { ru: 'Ориентирована на пользователей из России и СНГ', en: 'Focused on users from Russia and CIS' },
          { ru: 'Поддержка рубля на споте и P2P', en: 'RUB support on spot and P2P' },
          { ru: 'Регистрация в Грузии (лицензия)', en: 'Registered in Georgia (licensed)' }
        ],
        cons: [
          { ru: 'Меньше монет, чем на топовых биржах', en: 'Fewer coins than top exchanges' },
          { ru: 'Меньшая ликвидность', en: 'Lower liquidity' }
        ],
        summary: { 
          ru: 'Хороший запасной вариант, если крупные биржи введут ограничения. Подходит для обмена крипты на рубли.', 
          en: 'Good backup option if major exchanges impose restrictions. Suitable for exchanging crypto to RUB.' 
        }
      }
    },
    {
      name: 'Whitebird',
      desc: { ru: 'Обменник с рублями', en: 'Exchange with RUB' },
      url: 'https://whitebird.io',
      status: 'ru',
      icon: 'W',
      details: {
        access: { ru: 'Работает без VPN', en: 'Works without VPN' },
        kyc: { ru: 'Обязательна', en: 'Required' },
        p2p: { ru: 'Нет P2P, но есть прямой ввод/вывод рублей', en: 'No P2P, but direct RUB deposit/withdrawal' },
        fees: 'От 0.01% до 0.3%',
        pros: [
          { ru: 'Прямая работа с рублями', en: 'Direct work with RUB' },
          { ru: 'Низкие комиссии на некоторых парах', en: 'Low fees on some pairs' }
        ],
        cons: [
          { ru: 'Нет P2P-рынка', en: 'No P2P market' },
          { ru: 'Меньше торговых пар', en: 'Fewer trading pairs' }
        ],
        summary: { 
          ru: 'Подходит для тех, кто хочет быстро обменять крипту на рубли без P2P.', 
          en: 'Suitable for those who want to quickly exchange crypto to RUB without P2P.' 
        }
      }
    },
    {
      name: 'MEXC',
      desc: { ru: 'Ушла из РФ', en: 'Left Russia' },
      url: 'https://www.mexc.com',
      status: 'no',
      icon: 'M',
      details: {
        access: { ru: 'Прекратила работу в РФ с 20.10.2026', en: 'Stopped working in Russia since 20.10.2026' },
        kyc: { ru: '—', en: '—' },
        p2p: { ru: 'Отключен', en: 'Disabled' },
        fees: '—',
        pros: [
          { ru: 'Ранее предлагала нулевые комиссии и много монет', en: 'Previously offered zero fees and many coins' }
        ],
        cons: [
          { ru: 'Полностью недоступна для россиян', en: 'Completely unavailable for Russians' },
          { ru: 'Необходимо вывести средства', en: 'Funds must be withdrawn' }
        ],
        summary: { 
          ru: 'Не использовать. Биржа официально прекратила обслуживание пользователей из РФ.', 
          en: 'Do not use. The exchange officially stopped serving users from Russia.' 
        }
      }
    },
    {
      name: 'Binance',
      desc: { ru: 'Не работает в РФ', en: 'Does not work in Russia' },
      url: 'https://www.binance.com',
      status: 'no',
      icon: 'B',
      details: {
        access: { ru: 'Не работает в РФ с 2023 года', en: 'Not working in Russia since 2023' },
        kyc: { ru: '—', en: '—' },
        p2p: { ru: '—', en: '—' },
        fees: '—',
        pros: [
          { ru: 'Исторически самая крупная биржа мира', en: 'Historically the largest exchange in the world' }
        ],
        cons: [
          { ru: 'Полностью ушла с российского рынка', en: 'Completely left the Russian market' },
          { ru: 'Для доступа требуется зарубежный KYC и VPN', en: 'Foreign KYC and VPN required for access' }
        ],
        summary: { 
          ru: 'Для пользователей из РФ недоступна. Все активы были выведены или переведены на другие биржи.', 
          en: 'Unavailable for users from Russia. All assets were withdrawn or transferred to other exchanges.' 
        }
      }
    }
  ],
  learning: [
    {
      name: 'Binance Academy',
      desc: { ru: 'База знаний по крипте', en: 'Crypto knowledge base' },
      url: 'https://academy.binance.com',
      status: 'vpn',
      icon: '🎓',
      details: {
        access: { ru: 'Нужен VPN', en: 'VPN required' },
        kyc: { ru: '—', en: '—' }, p2p: { ru: '—', en: '—' }, fees: '—',
        pros: [{ ru: 'Фундаментальные статьи', en: 'Fundamental articles' }],
        cons: [{ ru: 'Некоторые материалы могут быть недоступны из РФ', en: 'Some materials may be unavailable from Russia' }],
        summary: { ru: 'Лучший источник базовых знаний, но может потребоваться VPN.', en: 'The best source of basic knowledge, but VPN may be required.' }
      }
    },
    {
      name: 'Bybit Learn',
      desc: { ru: 'Уроки трейдинга', en: 'Trading lessons' },
      url: 'https://learn.bybit.com',
      status: 'ru',
      icon: '📚',
      details: {
        access: { ru: 'Работает без VPN', en: 'Works without VPN' },
        kyc: { ru: '—', en: '—' }, p2p: { ru: '—', en: '—' }, fees: '—',
        pros: [{ ru: 'Практические уроки по трейдингу', en: 'Practical trading lessons' }, { ru: 'Актуальные стратегии', en: 'Current strategies' }],
        cons: [{ ru: 'Меньше статей, чем на Binance Academy', en: 'Fewer articles than Binance Academy' }],
        summary: { ru: 'Отличные практические руководства без необходимости VPN.', en: 'Excellent practical guides without the need for VPN.' }
      }
    },
    {
      name: 'Cointelegraph',
      desc: { ru: 'Аналитика и новости', en: 'Analytics and news' },
      url: 'https://cointelegraph.com',
      status: 'global',
      icon: '📰',
      details: {
        access: { ru: 'Работает глобально', en: 'Works globally' },
        kyc: { ru: '—', en: '—' }, p2p: { ru: '—', en: '—' }, fees: '—',
        pros: [{ ru: 'Много аналитики', en: 'Lots of analytics' }, { ru: 'Русскоязычная версия', en: 'Russian version available' }],
        cons: [{ ru: 'Иногда сенсационализм', en: 'Sometimes sensationalism' }],
        summary: { ru: 'Популярный ресурс с хорошей русскоязычной редакцией.', en: 'Popular resource with a good Russian edition.' }
      }
    }
  ],
  tools: [
    {
      name: 'TradingView',
      desc: { ru: 'Продвинутые графики', en: 'Advanced charts' },
      url: 'https://www.tradingview.com',
      status: 'global',
      icon: '📈',
      details: {
        access: { ru: 'Работает глобально', en: 'Works globally' },
        kyc: { ru: '—', en: '—' }, p2p: { ru: '—', en: '—' }, fees: '—',
        pros: [{ ru: 'Лучшие графики и индикаторы', en: 'Best charts and indicators' }, { ru: 'Огромное сообщество', en: 'Huge community' }],
        cons: [{ ru: 'Платные подписки для продвинутых функций', en: 'Paid subscriptions for advanced features' }],
        summary: { ru: 'Стандарт де-факто для технического анализа.', en: 'De facto standard for technical analysis.' }
      }
    },
    {
      name: 'CoinGecko',
      desc: { ru: 'Аналитика и данные', en: 'Analytics and data' },
      url: 'https://www.coingecko.com',
      status: 'global',
      icon: '🦎',
      details: {
        access: { ru: 'Работает глобально', en: 'Works globally' },
        kyc: { ru: '—', en: '—' }, p2p: { ru: '—', en: '—' }, fees: '—',
        pros: [{ ru: 'Глубокая аналитика по проектам', en: 'Deep analytics on projects' }, { ru: 'Независимые рейтинги', en: 'Independent ratings' }],
        cons: [{ ru: 'Интерфейс сложнее для новичка', en: 'Interface is more complex for a beginner' }],
        summary: { ru: 'Лучший источник для фундаментального анализа монет.', en: 'The best source for fundamental coin analysis.' }
      }
    }
  ]
};