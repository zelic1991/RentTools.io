// Shared shapes + helpers for the multi-language pre-arrival guest
// form. English is the base language: it lives in GuestFormTemplate.name
// and each field's label / helpText / options. Other languages are
// optional host-authored overrides stored in GuestFormTemplate.i18n —
// a JSON object keyed by locale. A missing or blank translation
// transparently falls back to English, so a half-translated form is
// always still usable.

export const GUEST_FORM_LOCALES = ["en", "ru", "de", "fr", "es", "hr", "pl", "cs", "sk", "hu"] as const;
export type GuestFormLocale = (typeof GUEST_FORM_LOCALES)[number];

/** Locales the host can translate into — everything except the English
 *  base (which is edited through the normal name / field inputs). */
export const TRANSLATABLE_LOCALES = ["ru", "de", "fr", "es", "hr", "pl", "cs", "sk", "hu"] as const;

/** Native language names, shown in both the builder tabs and the
 *  guest-facing language picker. */
export const LOCALE_NATIVE_NAME: Record<GuestFormLocale, string> = {
  en: "English",
  ru: "Русский",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  hr: "Hrvatski",
  pl: "Polski",
  cs: "Čeština",
  sk: "Slovenčina",
  hu: "Magyar",
};

export interface FieldTranslation {
  label?: string;
  helpText?: string;
  /** Parallel to the base field's options array — index i translates
   *  base option i. A blank entry falls back to the English option. */
  options?: string[];
}

export interface LocaleTranslation {
  name?: string;
  fields?: Record<string, FieldTranslation>;
}

export type GuestFormI18n = Record<string, LocaleTranslation>;

interface BaseField {
  id: string;
  type: string;
  label: string;
  helpText?: string;
  required: boolean;
  options?: string[];
}

/** Resolve a field's label / helpText / options for the chosen locale,
 *  falling back to the English base wherever a translation is missing
 *  or blank. Options fall back per-index so a partially-translated
 *  option list still renders. */
export function resolveField(
  field: BaseField,
  i18n: GuestFormI18n,
  locale: string,
): { label: string; helpText?: string; options?: string[] } {
  const tr = locale !== "en" ? i18n[locale]?.fields?.[field.id] : undefined;
  const label = tr?.label?.trim() ? tr.label : field.label;
  const helpText = tr?.helpText?.trim() ? tr.helpText : field.helpText;
  let options = field.options;
  if (field.options && tr?.options) {
    options = field.options.map((base, i) => {
      const t = tr.options?.[i];
      return typeof t === "string" && t.trim() ? t : base;
    });
  }
  return { label, helpText, options };
}

/** Resolve the form title for the chosen locale, falling back to the
 *  English base name. */
export function resolveName(
  baseName: string,
  i18n: GuestFormI18n,
  locale: string,
): string {
  if (locale !== "en") {
    const n = i18n[locale]?.name;
    if (typeof n === "string" && n.trim()) return n;
  }
  return baseName;
}

/** Which locales the guest may pick: English always, plus every locale
 *  the host actually authored some content for. */
export function availableLocales(i18n: GuestFormI18n): GuestFormLocale[] {
  const out: GuestFormLocale[] = ["en"];
  for (const loc of TRANSLATABLE_LOCALES) {
    const t = i18n[loc];
    if (!t) continue;
    const hasName = typeof t.name === "string" && t.name.trim().length > 0;
    const hasField =
      t.fields != null &&
      Object.values(t.fields).some(
        (f) =>
          (!!f.label && f.label.trim().length > 0) ||
          (!!f.helpText && f.helpText.trim().length > 0) ||
          (!!f.options && f.options.some((o) => !!o && o.trim().length > 0)),
      );
    if (hasName || hasField) out.push(loc);
  }
  return out;
}

/** Standing UI strings on the guest-facing form — the parts the host
 *  does NOT author (greeting, buttons, placeholders). Localised into
 *  the same five locales the guest can pick so a non-English guest
 *  sees a fully translated page, not a half-English one. */
export interface GuestUiCopy {
  greeting: (name: string) => string;
  intro: string;
  titleFallback: string;
  submit: string;
  submitting: string;
  thanks: string;
  submittedOn: (date: string) => string;
  selectPlaceholder: string;
  yes: string;
  no: string;
  language: string;
  submitFailed: string;
  privacy: GuestPrivacyCopy;
}

/** Localised copy for the inline privacy / data-handling panel shown
 *  above the form. Goal: address the wary-guest concerns ("who hosts
 *  this, how is it managed, is data protection guaranteed") before
 *  they're asked to type anything. Default collapsed under a small
 *  "Details" toggle so it doesn't dominate the page for guests who
 *  don't care, but the always-visible summary is enough to reassure
 *  on its own. */
export interface GuestPrivacyCopy {
  /** Title row, always visible. */
  title: string;
  /** One-sentence summary, always visible. */
  summary: string;
  /** Toggle label when the panel is collapsed. */
  showDetails: string;
  /** Toggle label when the panel is expanded. */
  hideDetails: string;
  /** Bullet-point detail blocks shown when expanded. Title + body
   *  text — links are added by the rendering component. */
  bullets: { title: string; body: string }[];
  /** Trailing link label that points at the full /privacy policy. */
  fullPolicyLabel: string;
  /** Inline "GitHub source" link label (in the "Where it's stored"
   *  bullet — placed by the component to keep COPY plain text). */
  sourceLinkLabel: string;
}

export const GUEST_UI_COPY: Record<GuestFormLocale, GuestUiCopy> = {
  en: {
    greeting: (n) => `Hi ${n}, please answer a few questions before your stay.`,
    intro: "Please answer a few questions before your stay.",
    titleFallback: "Pre-arrival form",
    submit: "Submit",
    submitting: "Submitting…",
    thanks: "Thanks — your answers are recorded.",
    submittedOn: (d) => `Submitted ${d}`,
    selectPlaceholder: "— select —",
    yes: "Yes",
    no: "No",
    language: "Language",
    submitFailed: "Submit failed",
    privacy: {
      title: "Privacy & data handling",
      summary:
        "Used for legally required guest registration and stay management — not marketing. Identity data is encrypted at rest and in transit.",
      showDetails: "Details",
      hideDetails: "Hide",
      bullets: [
        {
          title: "Who sees this",
          body: "The host and an explicitly authorised property manager. Cleaners and RentTools support impersonation cannot access the identity payload. Nothing is sold or used for advertising.",
        },
        {
          title: "Where it's stored",
          body: "The identity payload is application-encrypted before database storage. The connection to this form is HTTPS-encrypted. Uploaded ID images are not part of this form.",
        },
        {
          title: "No tracking",
          body: "No analytics or advertising cookies are loaded on this page. If you choose a language or theme, RentTools may store only that technical preference; the secure URL token attaches the form to the reservation.",
        },
        {
          title: "Your rights (GDPR / UK GDPR)",
          body: "You can ask your host to delete your answers at any time, or contact the operator at support@renttools.io for any privacy question, access request, or complaint.",
        },
      ],
      fullPolicyLabel: "Read the full RentTools privacy policy",
      sourceLinkLabel: "source on GitHub",
    },
  },
  ru: {
    greeting: (n) =>
      `Здравствуйте, ${n}! Пожалуйста, ответьте на несколько вопросов перед заездом.`,
    intro: "Пожалуйста, ответьте на несколько вопросов перед заездом.",
    titleFallback: "Анкета перед заездом",
    submit: "Отправить",
    submitting: "Отправка…",
    thanks: "Спасибо — ваши ответы сохранены.",
    submittedOn: (d) => `Отправлено ${d}`,
    selectPlaceholder: "— выберите —",
    yes: "Да",
    no: "Нет",
    language: "Язык",
    submitFailed: "Не удалось отправить",
    privacy: {
      title: "Конфиденциальность и обработка данных",
      summary:
        "Данные используются для обязательной регистрации гостей и управления проживанием, а не для маркетинга. Идентификационные данные шифруются при хранении и передаче.",
      showDetails: "Подробнее",
      hideDetails: "Свернуть",
      bullets: [
        {
          title: "Кто видит эти данные",
          body: "Хозяин и явно уполномоченный управляющий объектом. Уборщики и служба поддержки RentTools в режиме имитации не имеют доступа к идентификационным данным. Данные не продаются и не используются для рекламы.",
        },
        {
          title: "Где хранятся данные",
          body: "Идентификационные данные шифруются приложением до сохранения в базе. Соединение с формой защищено HTTPS. Загрузка фотографий документов в этом формуляре отключена.",
        },
        {
          title: "Никакого отслеживания",
          body: "На этой странице нет аналитики и рекламных cookies. Может сохраняться только выбранный язык или тема; форму связывает с бронированием защищённый токен в URL.",
        },
        {
          title: "Ваши права (GDPR)",
          body: "Вы можете в любой момент попросить хозяина удалить ваши ответы или написать оператору по адресу support@renttools.io по любому вопросу о конфиденциальности, доступе к данным или жалобе.",
        },
      ],
      fullPolicyLabel: "Полная политика конфиденциальности RentTools",
      sourceLinkLabel: "исходный код на GitHub",
    },
  },
  de: {
    greeting: (n) =>
      `Hallo ${n}, bitte beantworten Sie vor Ihrem Aufenthalt einige Fragen.`,
    intro: "Bitte beantworten Sie vor Ihrem Aufenthalt einige Fragen.",
    titleFallback: "Formular vor der Anreise",
    submit: "Absenden",
    submitting: "Wird gesendet…",
    thanks: "Danke — Ihre Antworten wurden gespeichert.",
    submittedOn: (d) => `Gesendet am ${d}`,
    selectPlaceholder: "— auswählen —",
    yes: "Ja",
    no: "Nein",
    language: "Sprache",
    submitFailed: "Senden fehlgeschlagen",
    privacy: {
      title: "Datenschutz & Datenverarbeitung",
      summary:
        "Verwendung nur für die gesetzlich erforderliche Gästeanmeldung und Aufenthaltsverwaltung — nicht für Marketing. Identitätsdaten werden verschlüsselt gespeichert und übertragen.",
      showDetails: "Details",
      hideDetails: "Ausblenden",
      bullets: [
        {
          title: "Wer sieht diese Angaben",
          body: "Der Gastgeber und ein ausdrücklich berechtigter Unterkunftsmanager. Reinigungskräfte und der RentTools-Support im Supportmodus erhalten keinen Zugriff auf die Identitätsdaten. Keine Verwendung für Werbung.",
        },
        {
          title: "Wo werden die Daten gespeichert",
          body: "Die Identitätsdaten werden vor der Speicherung in der Datenbank verschlüsselt. Auch die Verbindung zum Formular ist HTTPS-verschlüsselt. Ausweisbilder werden in diesem Formular nicht hochgeladen.",
        },
        {
          title: "Kein Tracking",
          body: "Auf dieser Seite werden keine Analyse-Tools oder Werbe-Cookies geladen. Nur eine gewählte Sprach- oder Darstellungspräferenz kann technisch gespeichert werden; die Zuordnung zur Reservierung erfolgt über den sicheren URL-Token.",
        },
        {
          title: "Ihre Rechte (DSGVO)",
          body: "Sie können Ihren Gastgeber jederzeit auffordern, Ihre Antworten zu löschen, oder den Betreiber unter support@renttools.io zu allen Fragen rund um Datenschutz, Auskunft oder Beschwerde kontaktieren.",
        },
      ],
      fullPolicyLabel: "Vollständige Datenschutzerklärung von RentTools",
      sourceLinkLabel: "Quellcode auf GitHub",
    },
  },
  fr: {
    greeting: (n) =>
      `Bonjour ${n}, merci de répondre à quelques questions avant votre séjour.`,
    intro: "Merci de répondre à quelques questions avant votre séjour.",
    titleFallback: "Formulaire avant l'arrivée",
    submit: "Envoyer",
    submitting: "Envoi…",
    thanks: "Merci — vos réponses ont été enregistrées.",
    submittedOn: (d) => `Envoyé le ${d}`,
    selectPlaceholder: "— sélectionner —",
    yes: "Oui",
    no: "Non",
    language: "Langue",
    submitFailed: "Échec de l'envoi",
    privacy: {
      title: "Confidentialité et traitement des données",
      summary:
        "Données utilisées pour l’enregistrement légal des voyageurs et la gestion du séjour, jamais à des fins marketing. Les données d’identité sont chiffrées au repos et en transit.",
      showDetails: "Détails",
      hideDetails: "Masquer",
      bullets: [
        {
          title: "Qui voit ces informations",
          body: "L’hôte et un gestionnaire du logement expressément autorisé. Le personnel de ménage et l’assistance RentTools en mode d’usurpation n’accèdent pas aux données d’identité. Aucune vente ni utilisation publicitaire.",
        },
        {
          title: "Où elles sont stockées",
          body: "Les données d’identité sont chiffrées par l’application avant leur stockage en base. La connexion au formulaire est chiffrée en HTTPS. Le dépôt d’images de pièces d’identité est désactivé ici.",
        },
        {
          title: "Aucun pistage",
          body: "Aucun outil d’analyse ni cookie publicitaire n’est chargé. Seule une préférence de langue ou d’affichage peut être mémorisée; le jeton sécurisé de l’URL relie le formulaire à la réservation.",
        },
        {
          title: "Vos droits (RGPD)",
          body: "Vous pouvez à tout moment demander à votre hôte de supprimer vos réponses, ou écrire à l'opérateur à support@renttools.io pour toute question, demande d'accès ou réclamation concernant la confidentialité.",
        },
      ],
      fullPolicyLabel: "Politique de confidentialité complète de RentTools",
      sourceLinkLabel: "code source sur GitHub",
    },
  },
  es: {
    greeting: (n) =>
      `Hola ${n}, por favor responda algunas preguntas antes de su estancia.`,
    intro: "Por favor responda algunas preguntas antes de su estancia.",
    titleFallback: "Formulario previo a la llegada",
    submit: "Enviar",
    submitting: "Enviando…",
    thanks: "Gracias — sus respuestas han sido registradas.",
    submittedOn: (d) => `Enviado el ${d}`,
    selectPlaceholder: "— seleccionar —",
    yes: "Sí",
    no: "No",
    language: "Idioma",
    submitFailed: "Error al enviar",
    privacy: {
      title: "Privacidad y tratamiento de datos",
      summary:
        "Datos usados para el registro legal de huéspedes y la gestión de la estancia, no para marketing. Los datos de identidad se cifran en reposo y en tránsito.",
      showDetails: "Detalles",
      hideDetails: "Ocultar",
      bullets: [
        {
          title: "Quién ve estos datos",
          body: "El anfitrión y un gestor del alojamiento autorizado expresamente. El personal de limpieza y el soporte de RentTools en modo de suplantación no acceden a los datos de identidad. No se venden ni se usan para publicidad.",
        },
        {
          title: "Dónde se almacenan",
          body: "Los datos de identidad se cifran en la aplicación antes de guardarlos en la base de datos. La conexión al formulario usa HTTPS. La carga de imágenes de documentos está desactivada aquí.",
        },
        {
          title: "Sin rastreo",
          body: "No se cargan herramientas de analítica ni cookies publicitarias. Solo puede guardarse una preferencia de idioma o apariencia; el token seguro de la URL vincula el formulario con la reserva.",
        },
        {
          title: "Sus derechos (RGPD)",
          body: "Puede pedir a su anfitrión que elimine sus respuestas en cualquier momento, o escribir al operador a support@renttools.io para cualquier consulta, solicitud de acceso o reclamación de privacidad.",
        },
      ],
      fullPolicyLabel: "Política de privacidad completa de RentTools",
      sourceLinkLabel: "código fuente en GitHub",
    },
  },
  hr: {
    greeting: (n) =>
      `Poštovani ${n}, molimo odgovorite na nekoliko pitanja prije dolaska.`,
    intro: "Molimo odgovorite na nekoliko pitanja prije dolaska.",
    titleFallback: "Obrazac prije dolaska",
    submit: "Pošalji",
    submitting: "Slanje…",
    thanks: "Hvala — vaši su odgovori zabilježeni.",
    submittedOn: (d) => `Poslano ${d}`,
    selectPlaceholder: "— odaberite —",
    yes: "Da",
    no: "Ne",
    language: "Jezik",
    submitFailed: "Slanje nije uspjelo",
    privacy: {
      title: "Privatnost i obrada podataka",
      summary:
        "Koristi se samo za zakonom obveznu prijavu gostiju i vođenje boravka — ne za marketing. Podaci o identitetu šifrirani su pri pohrani i prijenosu.",
      showDetails: "Detalji",
      hideDetails: "Sakrij",
      bullets: [
        {
          title: "Tko vidi ove podatke",
          body: "Domaćin i izrijekom ovlašteni upravitelj nekretnine. Čistačice i RentTools podrška u načinu pomoći nemaju pristup podacima o identitetu. Ništa se ne prodaje niti koristi za oglašavanje.",
        },
        {
          title: "Gdje se čuvaju",
          body: "Podaci o identitetu šifriraju se u aplikaciji prije pohrane u bazu. Veza s ovim obrascem šifrirana je HTTPS-om. Slike osobnih isprava nisu dio ovog obrasca.",
        },
        {
          title: "Bez praćenja",
          body: "Na ovoj se stranici ne učitavaju analitički ni oglašivački kolačići. Ako odaberete jezik ili izgled, RentTools može pohraniti samo tu tehničku postavku; sigurni token u adresi povezuje obrazac s rezervacijom.",
        },
        {
          title: "Vaša prava (GDPR)",
          body: "U svakom trenutku možete od domaćina zatražiti brisanje svojih odgovora ili kontaktirati operatera na support@renttools.io za sva pitanja o zaštiti podataka, uvidu ili pritužbi.",
        },
      ],
      fullPolicyLabel: "Cjelovita izjava o privatnosti RentToolsa",
      sourceLinkLabel: "Izvorni kod na GitHubu",
    },
  },
  pl: {
    greeting: (n) =>
      `Dzień dobry ${n}, prosimy o odpowiedź na kilka pytań przed pobytem.`,
    intro: "Prosimy o odpowiedź na kilka pytań przed pobytem.",
    titleFallback: "Formularz przed przyjazdem",
    submit: "Wyślij",
    submitting: "Wysyłanie…",
    thanks: "Dziękujemy — odpowiedzi zostały zapisane.",
    submittedOn: (d) => `Wysłano ${d}`,
    selectPlaceholder: "— wybierz —",
    yes: "Tak",
    no: "Nie",
    language: "Język",
    submitFailed: "Wysyłanie nie powiodło się",
    privacy: {
      title: "Prywatność i przetwarzanie danych",
      summary:
        "Dane służą wyłącznie do wymaganej prawem rejestracji gości i obsługi pobytu — nie do marketingu. Dane identyfikacyjne są szyfrowane podczas przechowywania i przesyłania.",
      showDetails: "Szczegóły",
      hideDetails: "Ukryj",
      bullets: [
        {
          title: "Kto to widzi",
          body: "Gospodarz i wyraźnie upoważniony zarządca obiektu. Osoby sprzątające oraz wsparcie RentTools w trybie pomocy nie mają dostępu do danych identyfikacyjnych. Nic nie jest sprzedawane ani wykorzystywane do reklam.",
        },
        {
          title: "Gdzie są przechowywane",
          body: "Dane identyfikacyjne są szyfrowane w aplikacji przed zapisem w bazie. Połączenie z formularzem jest szyfrowane HTTPS. Zdjęcia dokumentów nie są częścią tego formularza.",
        },
        {
          title: "Bez śledzenia",
          body: "Na tej stronie nie są ładowane pliki cookie analityczne ani reklamowe. Jeśli wybierzesz język lub wygląd, RentTools może zapisać wyłącznie to ustawienie techniczne; bezpieczny token w adresie łączy formularz z rezerwacją.",
        },
        {
          title: "Twoje prawa (RODO)",
          body: "W każdej chwili możesz poprosić gospodarza o usunięcie swoich odpowiedzi lub skontaktować się z operatorem pod adresem support@renttools.io we wszystkich sprawach dotyczących ochrony danych, dostępu do nich lub skargi.",
        },
      ],
      fullPolicyLabel: "Pełna polityka prywatności RentTools",
      sourceLinkLabel: "Kod źródłowy na GitHubie",
    },
  },
  cs: {
    greeting: (n) =>
      `Dobrý den ${n}, před pobytem prosím odpovězte na několik otázek.`,
    intro: "Před pobytem prosím odpovězte na několik otázek.",
    titleFallback: "Formulář před příjezdem",
    submit: "Odeslat",
    submitting: "Odesílání…",
    thanks: "Děkujeme — vaše odpovědi jsme zaznamenali.",
    submittedOn: (d) => `Odesláno ${d}`,
    selectPlaceholder: "— vyberte —",
    yes: "Ano",
    no: "Ne",
    language: "Jazyk",
    submitFailed: "Odeslání se nezdařilo",
    privacy: {
      title: "Soukromí a zpracování údajů",
      summary:
        "Údaje slouží pouze k zákonem vyžadované evidenci hostů a správě pobytu — nikoli k marketingu. Identifikační údaje jsou šifrovány při uložení i přenosu.",
      showDetails: "Podrobnosti",
      hideDetails: "Skrýt",
      bullets: [
        {
          title: "Kdo to vidí",
          body: "Hostitel a výslovně pověřený správce ubytování. Úklidový personál ani podpora RentTools v režimu pomoci k identifikačním údajům nemají přístup. Nic se neprodává ani nepoužívá k reklamě.",
        },
        {
          title: "Kde jsou uloženy",
          body: "Identifikační údaje se šifrují v aplikaci před uložením do databáze. Spojení s tímto formulářem je šifrováno pomocí HTTPS. Snímky dokladů nejsou součástí tohoto formuláře.",
        },
        {
          title: "Žádné sledování",
          body: "Na této stránce se nenačítají analytické ani reklamní soubory cookie. Pokud zvolíte jazyk nebo vzhled, RentTools může uložit pouze toto technické nastavení; bezpečný token v adrese propojuje formulář s rezervací.",
        },
        {
          title: "Vaše práva (GDPR)",
          body: "Kdykoli můžete hostitele požádat o smazání svých odpovědí nebo kontaktovat provozovatele na support@renttools.io ve všech otázkách ochrany údajů, přístupu k nim či stížnosti.",
        },
      ],
      fullPolicyLabel: "Úplné zásady ochrany soukromí RentTools",
      sourceLinkLabel: "Zdrojový kód na GitHubu",
    },
  },
  sk: {
    greeting: (n) =>
      `Dobrý deň ${n}, pred pobytom prosím odpovedzte na niekoľko otázok.`,
    intro: "Pred pobytom prosím odpovedzte na niekoľko otázok.",
    titleFallback: "Formulár pred príchodom",
    submit: "Odoslať",
    submitting: "Odosielanie…",
    thanks: "Ďakujeme — vaše odpovede sme zaznamenali.",
    submittedOn: (d) => `Odoslané ${d}`,
    selectPlaceholder: "— vyberte —",
    yes: "Áno",
    no: "Nie",
    language: "Jazyk",
    submitFailed: "Odoslanie zlyhalo",
    privacy: {
      title: "Súkromie a spracovanie údajov",
      summary:
        "Údaje slúžia len na zákonom vyžadovanú evidenciu hostí a správu pobytu — nie na marketing. Identifikačné údaje sú šifrované pri uložení aj prenose.",
      showDetails: "Podrobnosti",
      hideDetails: "Skryť",
      bullets: [
        {
          title: "Kto to vidí",
          body: "Hostiteľ a výslovne poverený správca ubytovania. Upratovací personál ani podpora RentTools v režime pomoci nemajú prístup k identifikačným údajom. Nič sa nepredáva ani nepoužíva na reklamu.",
        },
        {
          title: "Kde sú uložené",
          body: "Identifikačné údaje sa šifrujú v aplikácii pred uložením do databázy. Spojenie s týmto formulárom je šifrované cez HTTPS. Snímky dokladov nie sú súčasťou tohto formulára.",
        },
        {
          title: "Žiadne sledovanie",
          body: "Na tejto stránke sa nenačítavajú analytické ani reklamné súbory cookie. Ak si zvolíte jazyk alebo vzhľad, RentTools môže uložiť iba toto technické nastavenie; bezpečný token v adrese spája formulár s rezerváciou.",
        },
        {
          title: "Vaše práva (GDPR)",
          body: "Kedykoľvek môžete požiadať hostiteľa o vymazanie svojich odpovedí alebo kontaktovať prevádzkovateľa na support@renttools.io vo všetkých otázkach ochrany údajov, prístupu k nim či sťažnosti.",
        },
      ],
      fullPolicyLabel: "Úplné zásady ochrany súkromia RentTools",
      sourceLinkLabel: "Zdrojový kód na GitHube",
    },
  },
  hu: {
    greeting: (n) =>
      `Kedves ${n}, kérjük, válaszoljon néhány kérdésre az érkezés előtt.`,
    intro: "Kérjük, válaszoljon néhány kérdésre az érkezés előtt.",
    titleFallback: "Érkezés előtti űrlap",
    submit: "Beküldés",
    submitting: "Küldés…",
    thanks: "Köszönjük — válaszait rögzítettük.",
    submittedOn: (d) => `Beküldve: ${d}`,
    selectPlaceholder: "— válasszon —",
    yes: "Igen",
    no: "Nem",
    language: "Nyelv",
    submitFailed: "A beküldés nem sikerült",
    privacy: {
      title: "Adatvédelem és adatkezelés",
      summary:
        "Az adatokat kizárólag a jogszabály által előírt vendégnyilvántartáshoz és a tartózkodás kezeléséhez használjuk — marketingre nem. A személyazonosító adatok tárolás és továbbítás közben titkosítva vannak.",
      showDetails: "Részletek",
      hideDetails: "Elrejtés",
      bullets: [
        {
          title: "Ki látja ezeket",
          body: "A szállásadó és a kifejezetten felhatalmazott szálláskezelő. A takarítók és a RentTools támogatás segítő módban nem férnek hozzá a személyazonosító adatokhoz. Semmit nem adunk el és nem használunk hirdetésre.",
        },
        {
          title: "Hol tároljuk",
          body: "A személyazonosító adatokat az alkalmazás titkosítja, mielőtt az adatbázisba kerülnének. Az űrlappal való kapcsolat HTTPS-titkosított. Igazolványképek nem részei ennek az űrlapnak.",
        },
        {
          title: "Nincs nyomkövetés",
          body: "Ezen az oldalon nem töltődnek be analitikai vagy hirdetési sütik. Ha nyelvet vagy megjelenést választ, a RentTools csak ezt a technikai beállítást tárolhatja; a címben lévő biztonságos token köti az űrlapot a foglaláshoz.",
        },
        {
          title: "Az Ön jogai (GDPR)",
          body: "Bármikor kérheti a szállásadót válaszai törlésére, vagy megkeresheti az üzemeltetőt a support@renttools.io címen adatvédelemmel, hozzáféréssel vagy panasszal kapcsolatos bármely kérdésben.",
        },
      ],
      fullPolicyLabel: "A RentTools teljes adatvédelmi tájékoztatója",
      sourceLinkLabel: "Forráskód a GitHubon",
    },
  },
};

/** Validate an untrusted i18n blob at write time so a malformed PUT
 *  body cannot poison the JSON column. Unknown locales are dropped;
 *  empty translations are pruned so `availableLocales` stays accurate. */
export function sanitizeI18n(input: unknown): GuestFormI18n {
  if (!input || typeof input !== "object") return {};
  const out: GuestFormI18n = {};
  for (const loc of TRANSLATABLE_LOCALES) {
    const raw = (input as Record<string, unknown>)[loc];
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const entry: LocaleTranslation = {};
    if (typeof r.name === "string" && r.name.trim()) {
      entry.name = r.name.slice(0, 200);
    }
    if (r.fields && typeof r.fields === "object") {
      const fields: Record<string, FieldTranslation> = {};
      for (const [fid, fraw] of Object.entries(
        r.fields as Record<string, unknown>,
      )) {
        if (!fraw || typeof fraw !== "object") continue;
        const fr = fraw as Record<string, unknown>;
        const ft: FieldTranslation = {};
        if (typeof fr.label === "string" && fr.label.trim()) {
          ft.label = fr.label.slice(0, 200);
        }
        if (typeof fr.helpText === "string" && fr.helpText.trim()) {
          ft.helpText = fr.helpText.slice(0, 300);
        }
        if (Array.isArray(fr.options)) {
          const opts = fr.options
            .filter((o): o is string => typeof o === "string")
            .slice(0, 50)
            .map((o) => o.slice(0, 200));
          if (opts.some((o) => o.trim())) ft.options = opts;
        }
        if (ft.label || ft.helpText || ft.options) fields[fid] = ft;
      }
      if (Object.keys(fields).length > 0) entry.fields = fields;
    }
    if (entry.name || entry.fields) out[loc] = entry;
  }
  return out;
}
