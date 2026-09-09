export type Locale = "en" | "ru" | "de" | "fr" | "es" | "hr";

/**
 * Per-component copy table. English is mandatory; every other locale is
 * optional and falls back to English at the call site
 * (`resolveCopy(COPY, locale)`, which walks LOCALE_FALLBACK and ends at English). This is what lets a new language ship
 * before every one of its ~70 component tables is translated.
 */
export type CopyMap<T> = Record<"en", T> & Partial<Record<Locale, T>>;

/**
 * Where to look when a text is missing in the requested locale. Croatian
 * reads German first: the family that runs the apartment is more at home
 * in German than in English, and German is fully translated. Every chain
 * ends at English, which every table must carry.
 */
export const LOCALE_FALLBACK: Partial<Record<Locale, Locale>> = { hr: "de" };

/**
 * Pick the entry for `locale` from a copy table, walking LOCALE_FALLBACK
 * until something is there. An empty string counts as missing.
 */
/**
 * Croatian noun form for a count. The rule is by last digit, with the
 * teens as the exception: 1, 21, 31 take the singular; 2-4, 22-24 the
 * paucal; everything else - including 0 and 11-14 - the genitive plural.
 *
 * Words whose paucal and genitive plural coincide (dan/dana,
 * noć/noći) can pass the same string twice.
 */
export function hrPlural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function resolveCopy<T>(map: CopyMap<T>, locale: Locale): T {
  let l: Locale | undefined = locale;
  for (let hops = 0; l && hops < 8; hops++) {
    const v = map[l];
    if (v !== undefined && v !== "") return v;
    l = LOCALE_FALLBACK[l];
  }
  return map.en;
}

export const translations = {
  // Common
  "common.save": { en: "Save", ru: "Сохранить", de: "Speichern", fr: "Enregistrer", es: "Guardar", hr: "Spremi" },
  "common.cancel": { en: "Cancel", ru: "Отмена", de: "Abbrechen", fr: "Annuler", es: "Cancelar", hr: "Odustani" },
  "common.add": { en: "Add", ru: "Добавить", de: "Hinzufügen", fr: "Ajouter", es: "Añadir", hr: "Dodaj" },
  "common.edit": { en: "Edit", ru: "Редактировать", de: "Bearbeiten", fr: "Modifier", es: "Editar", hr: "Uredi" },
  "common.delete": { en: "Delete", ru: "Удалить", de: "Löschen", fr: "Supprimer", es: "Eliminar", hr: "Obriši" },
  "common.remove": { en: "Remove", ru: "Удалить", de: "Entfernen", fr: "Retirer", es: "Quitar", hr: "Ukloni" },
  "common.done": { en: "Done", ru: "Готово", de: "Fertig", fr: "Terminé", es: "Hecho", hr: "Gotovo" },
  "common.copied": { en: "Copied!", ru: "Скопировано!", de: "Kopiert!", fr: "Copié !", es: "¡Copiado!", hr: "Kopirano!" },
  "common.copy": { en: "Copy", ru: "Копировать", de: "Kopieren", fr: "Copier", es: "Copiar", hr: "Kopiraj" },
  "common.test": { en: "Test", ru: "Тест", de: "Test", fr: "Test", es: "Probar", hr: "Testiraj" },
  "common.back": { en: "Back", ru: "Назад", de: "Zurück", fr: "Retour", es: "Atrás", hr: "Natrag" },
  "common.refresh": { en: "Refresh", ru: "Обновить", de: "Aktualisieren", fr: "Actualiser", es: "Actualizar", hr: "Osvježi" },
  "common.days": { en: "days", ru: "дн.", de: "Tage", fr: "j.", es: "días", hr: "dana" },
  "common.day": { en: "day", ru: "день", de: "Tag", fr: "jour", es: "día", hr: "dan" },
  "common.nights": { en: "nights", ru: "ноч.", de: "Nächte", fr: "nuits", es: "noches", hr: "noćenja" },
  "common.night": { en: "night", ru: "ночь", de: "Nacht", fr: "nuit", es: "noche", hr: "noćenje" },
  "common.manual": { en: "Manual", ru: "Вручную", de: "Manuell", fr: "Manuel", es: "Manual", hr: "Ručno" },
  "common.calendar": { en: "Calendar", ru: "Календарь", de: "Kalender", fr: "Calendrier", es: "Calendario", hr: "Kalendar" },

  // Login
  "login.title": { en: "RentTools", ru: "RentTools", de: "RentTools", fr: "RentTools", es: "RentTools", hr: "RentTools" },
  "login.subtitle": { en: "Sign in to continue", ru: "Войдите для продолжения", de: "Anmelden, um fortzufahren", fr: "Connectez-vous pour continuer", es: "Inicie sesión para continuar", hr: "Prijavite se za nastavak" },
  "login.username": { en: "Username", ru: "Логин", de: "Benutzername", fr: "Identifiant", es: "Usuario", hr: "Korisničko ime" },
  "login.usernamePlaceholder": { en: "Enter username", ru: "Введите логин", de: "Benutzername eingeben", fr: "Saisissez votre identifiant", es: "Introduzca el usuario", hr: "Unesite korisničko ime" },
  "login.password": { en: "Password", ru: "Пароль", de: "Passwort", fr: "Mot de passe", es: "Contraseña", hr: "Lozinka" },
  "login.passwordPlaceholder": { en: "Enter password", ru: "Введите пароль", de: "Passwort eingeben", fr: "Saisissez votre mot de passe", es: "Introduzca la contraseña", hr: "Unesite lozinku" },
  "login.signingIn": { en: "Signing in...", ru: "Входим...", de: "Anmeldung läuft...", fr: "Connexion en cours...", es: "Iniciando sesión...", hr: "Prijava..." },
  "login.signIn": { en: "Sign in", ru: "Войти", de: "Anmelden", fr: "Se connecter", es: "Iniciar sesión", hr: "Prijavi se" },
  "login.failed": { en: "Login failed", ru: "Ошибка входа", de: "Anmeldung fehlgeschlagen", fr: "Échec de la connexion", es: "Error al iniciar sesión", hr: "Prijava nije uspjela" },
  "login.connectionError": { en: "Connection error", ru: "Ошибка соединения", de: "Verbindungsfehler", fr: "Erreur de connexion", es: "Error de conexión", hr: "Greška u vezi" },
  "login.noAccount": { en: "Don't have an account?", ru: "Нет аккаунта?", de: "Noch kein Konto?", fr: "Pas encore de compte ?", es: "¿No tiene cuenta?", hr: "Nemate račun?" },
  "login.signUpLink": { en: "Sign up", ru: "Зарегистрироваться", de: "Registrieren", fr: "S'inscrire", es: "Registrarse", hr: "Registrirajte se" },
  "login.continueWithGoogle": { en: "Continue with Google", ru: "Войти через Google", de: "Mit Google anmelden", fr: "Continuer avec Google", es: "Continuar con Google", hr: "Nastavi s Googleom" },
  "login.or": { en: "or", ru: "или", de: "oder", fr: "ou", es: "o", hr: "ili" },
  "login.googleError": { en: "Google sign-in failed. Try again or use your password.", ru: "Не удалось войти через Google. Попробуйте снова или используйте пароль.", de: "Google-Anmeldung fehlgeschlagen. Erneut versuchen oder Passwort verwenden.", fr: "Échec de la connexion Google. Réessayez ou utilisez votre mot de passe.", es: "Error al iniciar sesión con Google. Vuelva a intentarlo o use su contraseña.", hr: "Prijava putem Googlea nije uspjela. Pokušajte ponovno ili upotrijebite lozinku." },

  "login.email": { en: "Email", ru: "Эл. почта", de: "E-Mail", fr: "E-mail", es: "Correo electrónico", hr: "E-mail" },
  "login.emailPlaceholder": { en: "you@example.com", ru: "you@example.com", de: "you@example.com", fr: "you@example.com", es: "you@example.com", hr: "vi@primjer.com" },
  "login.forgotPassword": { en: "Forgot password?", ru: "Забыли пароль?", de: "Passwort vergessen?", fr: "Mot de passe oublié ?", es: "¿Olvidó su contraseña?", hr: "Zaboravili ste lozinku?" },

  // Signup
  "signup.title": { en: "Create account", ru: "Создать аккаунт", de: "Konto erstellen", fr: "Créer un compte", es: "Crear cuenta", hr: "Otvorite račun" },
  "signup.subtitle": { en: "Sign up to get started", ru: "Зарегистрируйтесь, чтобы начать", de: "Registrieren und loslegen", fr: "Inscrivez-vous pour commencer", es: "Regístrese para comenzar", hr: "Registrirajte se za početak" },
  "signup.creating": { en: "Creating account...", ru: "Создаём аккаунт...", de: "Konto wird erstellt...", fr: "Création du compte...", es: "Creando cuenta...", hr: "Stvaranje računa..." },
  "signup.signUp": { en: "Sign up", ru: "Зарегистрироваться", de: "Registrieren", fr: "S'inscrire", es: "Registrarse", hr: "Registriraj se" },
  "signup.failed": { en: "Sign up failed", ru: "Ошибка регистрации", de: "Registrierung fehlgeschlagen", fr: "Échec de l'inscription", es: "Error al registrarse", hr: "Registracija nije uspjela" },
  "signup.haveAccount": { en: "Already have an account?", ru: "Уже есть аккаунт?", de: "Bereits ein Konto?", fr: "Déjà un compte ?", es: "¿Ya tiene cuenta?", hr: "Već imate račun?" },
  "signup.signInLink": { en: "Sign in", ru: "Войти", de: "Anmelden", fr: "Se connecter", es: "Iniciar sesión", hr: "Prijavite se" },
  "signup.continueWithGoogle": { en: "Sign up with Google", ru: "Регистрация через Google", de: "Mit Google registrieren", fr: "S'inscrire avec Google", es: "Registrarse con Google", hr: "Registracija Googleom" },
  "signup.checkEmailTitle": { en: "Check your email", ru: "Проверьте почту", de: "Prüfen Sie Ihre E-Mail", fr: "Vérifiez vos e-mails", es: "Revise su correo", hr: "Provjerite e-mail" },
  "signup.checkEmailSubtitle": { en: "Enter the 6-digit code we sent to {email}", ru: "Введите 6-значный код, отправленный на {email}", de: "Geben Sie den 6-stelligen Code ein, den wir an {email} gesendet haben", fr: "Saisissez le code à 6 chiffres envoyé à {email}", es: "Introduzca el código de 6 dígitos que enviamos a {email}", hr: "Unesite kod od 6 znamenki koji smo poslali na {email}" },
  "signup.code": { en: "Verification code", ru: "Код подтверждения", de: "Bestätigungscode", fr: "Code de vérification", es: "Código de verificación", hr: "Kod za potvrdu" },
  "signup.codePlaceholder": { en: "6-digit code", ru: "6-значный код", de: "6-stelliger Code", fr: "Code à 6 chiffres", es: "Código de 6 dígitos", hr: "Kod od 6 znamenki" },
  "signup.verify": { en: "Verify & create account", ru: "Подтвердить и создать аккаунт", de: "Bestätigen & Konto erstellen", fr: "Vérifier et créer le compte", es: "Verificar y crear cuenta", hr: "Potvrdi i otvori račun" },
  "signup.verifying": { en: "Verifying...", ru: "Проверяем...", de: "Wird überprüft...", fr: "Vérification...", es: "Verificando...", hr: "Provjera..." },
  "signup.resendCode": { en: "Resend code", ru: "Отправить код повторно", de: "Code erneut senden", fr: "Renvoyer le code", es: "Reenviar código", hr: "Pošalji kod ponovno" },
  "signup.resent": { en: "A new code is on its way", ru: "Новый код отправлен", de: "Ein neuer Code ist unterwegs", fr: "Un nouveau code est en route", es: "Un nuevo código está en camino", hr: "Novi kod je na putu" },
  "signup.useDifferentEmail": { en: "Use a different email", ru: "Использовать другую почту", de: "Andere E-Mail verwenden", fr: "Utiliser une autre adresse", es: "Usar otro correo", hr: "Upotrijebi drugi e-mail" },

  // Password reset
  "reset.title": { en: "Reset password", ru: "Сброс пароля", de: "Passwort zurücksetzen", fr: "Réinitialiser le mot de passe", es: "Restablecer contraseña", hr: "Ponovno postavljanje lozinke" },
  "reset.subtitle": { en: "Enter your account email and we'll send a reset code.", ru: "Введите эл. почту аккаунта — мы отправим код для сброса.", de: "Geben Sie Ihre Konto-E-Mail ein, wir senden einen Reset-Code.", fr: "Saisissez l'e-mail de votre compte, nous enverrons un code de réinitialisation.", es: "Introduzca el correo de su cuenta y le enviaremos un código.", hr: "Unesite e-mail svog računa i poslat ćemo kod za promjenu." },
  "reset.send": { en: "Send reset code", ru: "Отправить код", de: "Reset-Code senden", fr: "Envoyer le code", es: "Enviar código", hr: "Pošalji kod" },
  "reset.sending": { en: "Sending...", ru: "Отправляем...", de: "Wird gesendet...", fr: "Envoi...", es: "Enviando...", hr: "Slanje..." },
  "reset.sentTitle": { en: "Check your email", ru: "Проверьте почту", de: "Prüfen Sie Ihre E-Mail", fr: "Vérifiez vos e-mails", es: "Revise su correo", hr: "Provjerite e-mail" },
  "reset.sentSubtitle": { en: "If an account exists for that address, a 6-digit reset code is on its way.", ru: "Если аккаунт с такой почтой существует, 6-значный код уже в пути.", de: "Falls ein Konto mit dieser Adresse existiert, ist ein 6-stelliger Code unterwegs.", fr: "Si un compte existe pour cette adresse, un code à 6 chiffres est en route.", es: "Si existe una cuenta con esa dirección, un código de 6 dígitos está en camino.", hr: "Ako račun za tu adresu postoji, kod od 6 znamenki je na putu." },
  "reset.code": { en: "Reset code", ru: "Код для сброса", de: "Reset-Code", fr: "Code de réinitialisation", es: "Código de restablecimiento", hr: "Kod za promjenu" },
  "reset.codePlaceholder": { en: "6-digit code", ru: "6-значный код", de: "6-stelliger Code", fr: "Code à 6 chiffres", es: "Código de 6 dígitos", hr: "Kod od 6 znamenki" },
  "reset.newPassword": { en: "New password", ru: "Новый пароль", de: "Neues Passwort", fr: "Nouveau mot de passe", es: "Nueva contraseña", hr: "Nova lozinka" },
  "reset.newPasswordPlaceholder": { en: "Enter a new password", ru: "Введите новый пароль", de: "Neues Passwort eingeben", fr: "Saisissez un nouveau mot de passe", es: "Introduzca una nueva contraseña", hr: "Unesite novu lozinku" },
  "reset.submit": { en: "Update password", ru: "Обновить пароль", de: "Passwort aktualisieren", fr: "Mettre à jour le mot de passe", es: "Actualizar contraseña", hr: "Promijeni lozinku" },
  "reset.submitting": { en: "Updating...", ru: "Обновляем...", de: "Wird aktualisiert...", fr: "Mise à jour...", es: "Actualizando...", hr: "Mijenjanje..." },
  "reset.doneTitle": { en: "Password updated", ru: "Пароль обновлён", de: "Passwort aktualisiert", fr: "Mot de passe mis à jour", es: "Contraseña actualizada", hr: "Lozinka promijenjena" },
  "reset.doneSubtitle": { en: "Sign in with your new password.", ru: "Войдите с новым паролем.", de: "Melden Sie sich mit Ihrem neuen Passwort an.", fr: "Connectez-vous avec votre nouveau mot de passe.", es: "Inicie sesión con su nueva contraseña.", hr: "Prijavite se novom lozinkom." },
  "reset.backToLogin": { en: "Back to sign in", ru: "Вернуться ко входу", de: "Zurück zur Anmeldung", fr: "Retour à la connexion", es: "Volver a iniciar sesión", hr: "Natrag na prijavu" },
  "reset.failed": { en: "Couldn't reset password", ru: "Не удалось сбросить пароль", de: "Passwort konnte nicht zurückgesetzt werden", fr: "Échec de la réinitialisation", es: "No se pudo restablecer la contraseña", hr: "Promjena lozinke nije uspjela" },

  // Welcome modal (first-time)
  "welcome.title": { en: "Welcome to RentTools", ru: "Добро пожаловать в RentTools", de: "Willkommen bei RentTools", fr: "Bienvenue sur RentTools", es: "Bienvenido a RentTools", hr: "Dobro došli u RentTools" },
  "welcome.subtitle": { en: "Let's get started — pick one to set up your workspace.", ru: "Давайте начнём — выберите способ настройки.", de: "Loslegen — wählen Sie eine Option, um Ihren Arbeitsbereich einzurichten.", fr: "On commence — choisissez une option pour configurer votre espace.", es: "Comencemos — elija una opción para configurar su espacio.", hr: "Krenimo — odaberite jedno za postavljanje radnog prostora." },
  "welcome.addFirst": { en: "Add my first property", ru: "Добавить первый объект", de: "Erste Unterkunft hinzufügen", fr: "Ajouter mon premier logement", es: "Añadir mi primer alojamiento", hr: "Dodaj moju prvu nekretninu" },
  "welcome.namePlaceholder": { en: "Property name", ru: "Название объекта", de: "Name der Unterkunft", fr: "Nom du logement", es: "Nombre del alojamiento", hr: "Naziv nekretnine" },
  "welcome.create": { en: "Create", ru: "Создать", de: "Erstellen", fr: "Créer", es: "Crear", hr: "Stvori" },
  "welcome.useSample": { en: "Use a sample property", ru: "Создать пример", de: "Beispiel-Unterkunft verwenden", fr: "Utiliser un logement d'exemple", es: "Usar un alojamiento de ejemplo", hr: "Koristi primjer nekretnine" },
  "welcome.dismiss": { en: "Skip for now", ru: "Пропустить", de: "Später", fr: "Plus tard", es: "Más tarde", hr: "Preskoči za sada" },

  // Empty states
  "empty.calendar.title": { en: "No bookings yet", ru: "Бронирований пока нет", de: "Noch keine Buchungen", fr: "Aucune réservation pour l'instant", es: "Aún no hay reservas", hr: "Još nema rezervacija" },
  "empty.calendar.desc": { en: "Sync a calendar or add a booking manually to get started.", ru: "Синхронизируйте календарь или добавьте бронирование вручную.", de: "Synchronisieren Sie einen Kalender oder fügen Sie eine Buchung manuell hinzu.", fr: "Synchronisez un calendrier ou ajoutez une réservation manuellement pour commencer.", es: "Sincronice un calendario o añada una reserva manualmente para empezar.", hr: "Povežite kalendar ili ručno dodajte rezervaciju za početak." },
  "empty.cleaning.title": { en: "No cleanings scheduled", ru: "Уборки не запланированы", de: "Keine Reinigungen geplant", fr: "Aucun ménage prévu", es: "No hay limpiezas programadas", hr: "Nema zakazanih čišćenja" },
  "empty.cleaning.desc": { en: "Cleaning days appear automatically the day after each check-out.", ru: "Уборки появятся автоматически на следующий день после выезда.", de: "Reinigungstage erscheinen automatisch am Tag nach jedem Check-out.", fr: "Les jours de ménage apparaissent automatiquement le lendemain de chaque départ.", es: "Los días de limpieza aparecen automáticamente al día siguiente de cada check-out.", hr: "Dani čišćenja pojavljuju se automatski dan nakon svake odjave." },
  "empty.sync.title": { en: "Not connected", ru: "Не подключено", de: "Nicht verbunden", fr: "Non connecté", es: "Sin conexión", hr: "Nije povezano" },
  "empty.sync.desc": { en: "Connect Airbnb or Booking.com to start syncing reservations.", ru: "Подключите Airbnb или Booking.com, чтобы начать синхронизацию.", de: "Verbinden Sie Airbnb oder Booking.com, um Reservierungen zu synchronisieren.", fr: "Connectez Airbnb ou Booking.com pour synchroniser vos réservations.", es: "Conecte Airbnb o Booking.com para empezar a sincronizar reservas.", hr: "Povežite Airbnb ili Booking.com za sinkronizaciju rezervacija." },

  // Onboarding tooltips
  "tooltip.editDates": { en: "Click any date to override its status.", ru: "Нажмите на дату, чтобы изменить её статус.", de: "Auf ein Datum klicken, um seinen Status zu überschreiben.", fr: "Cliquez sur une date pour modifier son statut.", es: "Haga clic en una fecha para forzar su estado.", hr: "Kliknite bilo koji datum za promjenu statusa." },
  "tooltip.icalUrl": { en: "Paste your Airbnb iCal export URL here.", ru: "Вставьте сюда iCal-ссылку из Airbnb.", de: "Fügen Sie hier Ihre iCal-Export-URL von Airbnb ein.", fr: "Collez ici l'URL iCal d'export d'Airbnb.", es: "Pegue aquí la URL iCal de exportación de Airbnb.", hr: "Zalijepite ovdje svoj Airbnb iCal izvozni URL." },

  // Profile
  "profile.title": { en: "Profile", ru: "Профиль", de: "Profil", fr: "Profil", es: "Perfil", hr: "Profil" },
  "profile.username": { en: "Username", ru: "Логин", de: "Benutzername", fr: "Identifiant", es: "Usuario", hr: "Korisničko ime" },
  "profile.role": { en: "Role", ru: "Роль", de: "Rolle", fr: "Rôle", es: "Rol", hr: "Uloga" },
  "profile.createdAt": { en: "Member since", ru: "С нами с", de: "Mitglied seit", fr: "Membre depuis", es: "Miembro desde", hr: "Član od" },
  "profile.changePassword": { en: "Change password", ru: "Сменить пароль", de: "Passwort ändern", fr: "Modifier le mot de passe", es: "Cambiar contraseña", hr: "Promijeni lozinku" },
  "profile.currentPassword": { en: "Current password", ru: "Текущий пароль", de: "Aktuelles Passwort", fr: "Mot de passe actuel", es: "Contraseña actual", hr: "Trenutna lozinka" },
  "profile.newPassword": { en: "New password", ru: "Новый пароль", de: "Neues Passwort", fr: "Nouveau mot de passe", es: "Nueva contraseña", hr: "Nova lozinka" },
  "profile.save": { en: "Save", ru: "Сохранить", de: "Speichern", fr: "Enregistrer", es: "Guardar", hr: "Spremi" },
  "profile.saved": { en: "Password updated", ru: "Пароль обновлён", de: "Passwort aktualisiert", fr: "Mot de passe mis à jour", es: "Contraseña actualizada", hr: "Lozinka promijenjena" },
  "profile.close": { en: "Close", ru: "Закрыть", de: "Schließen", fr: "Fermer", es: "Cerrar", hr: "Zatvori" },

  // Sidebar
  "sidebar.title": { en: "RentTools", ru: "RentTools", de: "RentTools", fr: "RentTools", es: "RentTools", hr: "RentTools" },
  "sidebar.subtitle": { en: "Properties & guests", ru: "Объекты и гости", de: "Unterkünfte & Gäste", fr: "Logements et voyageurs", es: "Alojamientos y huéspedes", hr: "Nekretnine i gosti" },
  "sidebar.dashboard": { en: "Dashboard", ru: "Обзор", de: "Übersicht", fr: "Tableau de bord", es: "Panel", hr: "Pregled" },
  "sidebar.tasks": { en: "Tasks", ru: "Задачи", de: "Aufgaben", fr: "Tâches", es: "Tareas", hr: "Zadaci" },
  "sidebar.properties": { en: "Properties", ru: "Объекты", de: "Unterkünfte", fr: "Logements", es: "Alojamientos", hr: "Nekretnine" },
  "sidebar.propertyPlaceholder": { en: "Property name...", ru: "Название объекта...", de: "Name der Unterkunft...", fr: "Nom du logement...", es: "Nombre del alojamiento...", hr: "Naziv nekretnine..." },
  "sidebar.noProperties": { en: "No properties yet", ru: "Объектов пока нет", de: "Noch keine Unterkünfte", fr: "Aucun logement pour l'instant", es: "Aún no hay alojamientos", hr: "Još nema nekretnina" },
  "sidebar.addReservation": { en: "Add reservation", ru: "Добавить бронь", de: "Reservierung hinzufügen", fr: "Ajouter une réservation", es: "Añadir reserva", hr: "Dodaj rezervaciju" },
  "sidebar.calendarSync": { en: "Calendar Sync", ru: "Синхронизация", de: "Kalendersynchronisation", fr: "Synchronisation des calendriers", es: "Sincronización de calendarios", hr: "Sinkronizacija kalendara" },
  "sidebar.settings": { en: "Settings", ru: "Настройки", de: "Einstellungen", fr: "Paramètres", es: "Ajustes", hr: "Postavke" },
  "sidebar.logout": { en: "Logout", ru: "Выйти", de: "Abmelden", fr: "Se déconnecter", es: "Cerrar sesión", hr: "Odjava" },
  "sidebar.guestName": { en: "Guest name...", ru: "Имя гостя...", de: "Gastname...", fr: "Nom du voyageur...", es: "Nombre del huésped...", hr: "Ime gosta..." },

  // Dashboard
  "dashboard.title": { en: "Dashboard", ru: "Обзор", de: "Übersicht", fr: "Tableau de bord", es: "Panel", hr: "Pregled" },
  "dashboard.newReservation": { en: "New Reservation", ru: "Новая бронь", de: "Neue Reservierung", fr: "Nouvelle réservation", es: "Nueva reserva", hr: "Nova rezervacija" },
  "dashboard.property": { en: "Property", ru: "Объект", de: "Unterkunft", fr: "Logement", es: "Alojamiento", hr: "Nekretnina" },
  "dashboard.selectProperty": { en: "Select property...", ru: "Выберите объект...", de: "Unterkunft wählen...", fr: "Choisir un logement...", es: "Seleccione un alojamiento...", hr: "Odaberite nekretninu..." },
  "dashboard.guestName": { en: "Guest name", ru: "Имя гостя", de: "Gastname", fr: "Nom du voyageur", es: "Nombre del huésped", hr: "Ime gosta" },
  "dashboard.enterName": { en: "Enter name...", ru: "Введите имя...", de: "Name eingeben...", fr: "Saisissez un nom...", es: "Introduzca un nombre...", hr: "Unesite ime..." },
  "dashboard.platform": { en: "Platform", ru: "Платформа", de: "Plattform", fr: "Plateforme", es: "Plataforma", hr: "Platforma" },
  "dashboard.dates": { en: "Dates", ru: "Даты", de: "Daten", fr: "Dates", es: "Fechas", hr: "Datumi" },
  "dashboard.createReservation": { en: "Create Reservation", ru: "Создать бронь", de: "Reservierung erstellen", fr: "Créer la réservation", es: "Crear reserva", hr: "Stvori rezervaciju" },
  "dashboard.reservations": { en: "Reservations", ru: "Бронирования", de: "Reservierungen", fr: "Réservations", es: "Reservas", hr: "Rezervacije" },
  "dashboard.recentReservations": { en: "Recent Reservations", ru: "Последние бронирования", de: "Letzte Reservierungen", fr: "Réservations récentes", es: "Reservas recientes", hr: "Nedavne rezervacije" },
  "dashboard.upcomingReservations": { en: "Upcoming Reservations", ru: "Предстоящие бронирования", de: "Anstehende Reservierungen", fr: "Réservations à venir", es: "Próximas reservas", hr: "Nadolazeće rezervacije" },
  "dashboard.past": { en: "Past", ru: "Прошедшие", de: "Vergangene", fr: "Passées", es: "Pasadas", hr: "Prošle" },
  "dashboard.showPast": { en: "Show past ({n})", ru: "Показать прошедшие ({n})", de: "Vergangene anzeigen ({n})", fr: "Afficher les passées ({n})", es: "Mostrar pasadas ({n})", hr: "Prikaži prošle ({n})" },
  "dashboard.hidePast": { en: "Hide past", ru: "Скрыть прошедшие", de: "Vergangene ausblenden", fr: "Masquer les passées", es: "Ocultar pasadas", hr: "Sakrij prošle" },
  "dashboard.noReservations": { en: "No reservations yet. Click 'New Reservation' to create one.", ru: "Бронирований пока нет. Нажмите 'Новая бронь' для создания.", de: "Noch keine Reservierungen. Auf „Neue Reservierung“ klicken, um eine anzulegen.", fr: "Aucune réservation pour l'instant. Cliquez sur « Nouvelle réservation » pour en créer une.", es: "Aún no hay reservas. Pulse «Nueva reserva» para crear una.", hr: "Još nema rezervacija. Kliknite „Nova rezervacija“ za stvaranje." },
  "dashboard.noReservationsGlobal": { en: "No reservations yet. Create a property and add reservations to get started.", ru: "Бронирований пока нет. Создайте объект и добавьте бронь.", de: "Noch keine Reservierungen. Legen Sie eine Unterkunft an und fügen Sie Reservierungen hinzu.", fr: "Aucune réservation pour l'instant. Créez un logement et ajoutez des réservations pour commencer.", es: "Aún no hay reservas. Cree un alojamiento y añada reservas para empezar.", hr: "Još nema rezervacija. Stvorite nekretninu i dodajte rezervacije za početak." },
  "dashboard.emptyTitle": { en: "Start with your first property", ru: "Начните с первого объекта", de: "Mit der ersten Unterkunft beginnen", fr: "Commencez par votre premier logement", es: "Empiece por su primer alojamiento", hr: "Počnite sa svojom prvom nekretninom" },
  "dashboard.emptyBody": { en: "RentTools needs a property before you can sync calendars or track reservations. Add one in under a minute — or try a pre-filled sample to see how it works.", ru: "RentTools нужен объект, чтобы синхронизировать календари и отслеживать бронирования. Это занимает меньше минуты — или попробуйте заполненный пример.", de: "RentTools braucht eine Unterkunft, bevor Sie Kalender synchronisieren oder Reservierungen verfolgen können. In unter einer Minute angelegt — oder probieren Sie ein fertiges Beispiel aus.", fr: "RentTools a besoin d'un logement avant de synchroniser des calendriers ou de suivre des réservations. À ajouter en moins d'une minute — ou essayez un exemple pré-rempli pour voir le fonctionnement.", es: "RentTools necesita un alojamiento antes de sincronizar calendarios o seguir reservas. Añádalo en menos de un minuto — o pruebe un ejemplo precargado para ver cómo funciona.", hr: "RentTools treba nekretninu prije sinkronizacije kalendara ili praćenja rezervacija. Dodajte je za manje od minute — ili isprobajte gotov primjer da vidite kako radi." },
  "dashboard.emptyAdd": { en: "Add my first property", ru: "Добавить первый объект", de: "Erste Unterkunft hinzufügen", fr: "Ajouter mon premier logement", es: "Añadir mi primer alojamiento", hr: "Dodaj moju prvu nekretninu" },
  "dashboard.emptySample": { en: "Use a sample property", ru: "Создать пример", de: "Beispiel-Unterkunft verwenden", fr: "Utiliser un logement d'exemple", es: "Usar un alojamiento de ejemplo", hr: "Koristi primjer nekretnine" },
  "dashboard.reservationsAcross": { en: "reservations across", ru: "бронирований в", de: "Reservierungen in", fr: "réservations sur", es: "reservas en", hr: "rezervacija u" },
  "dashboard.reservation": { en: "reservation", ru: "бронирование", de: "Reservierung", fr: "réservation", es: "reserva", hr: "rezervacija" },
  "dashboard.today": { en: "Today", ru: "Сегодня", de: "Heute", fr: "Aujourd'hui", es: "Hoy", hr: "Danas" },
  "dashboard.todayCheckIn": { en: "Check-in", ru: "Заезд", de: "Check-in", fr: "Arrivée", es: "Entrada", hr: "Prijava" },
  "dashboard.todayCheckOut": { en: "Check-out", ru: "Выезд", de: "Check-out", fr: "Départ", es: "Salida", hr: "Odjava" },
  "dashboard.cleanerConflictBadge": { en: "Cleaner conflict", ru: "Конфликт уборщика", de: "Reinigungskraft-Konflikt", fr: "Conflit d'agent d'entretien", es: "Conflicto de limpiador", hr: "Sukob čistačice" },
  "dashboard.cleanerConflictHint": { en: "Same cleaner is the default for two or more properties on the same day.", ru: "Один уборщик назначен по умолчанию на двух или более объектах в один день.", de: "Dieselbe Reinigungskraft ist Standard für zwei oder mehr Unterkünfte am selben Tag.", fr: "Le même agent d'entretien est attribué par défaut à deux logements ou plus le même jour.", es: "El mismo limpiador está asignado por defecto a dos o más alojamientos el mismo día.", hr: "Ista čistačica zadana je za dvije ili više nekretnina istog dana." },
  "dashboard.formConflict": { en: "Conflicts with existing booking", ru: "Конфликт с существующим бронированием", de: "Konflikt mit bestehender Buchung", fr: "Conflit avec une réservation existante", es: "Conflicto con una reserva existente", hr: "Preklapa se s postojećom rezervacijom" },
  "dashboard.formConflicts": { en: "Conflicts with {n} existing bookings", ru: "Конфликт с {n} бронированиями", de: "Konflikt mit {n} bestehenden Buchungen", fr: "Conflit avec {n} réservations existantes", es: "Conflicto con {n} reservas existentes", hr: "Preklapa se s {n} postojećih rezervacija" },

  // Property Calendar
  "calendar.editDates": { en: "Edit Dates", ru: "Ред. даты", de: "Daten bearb.", fr: "Modifier les dates", es: "Editar fechas", hr: "Uredi datume" },
  "calendar.doneEditing": { en: "Done Editing", ru: "Готово", de: "Fertig", fr: "Terminé", es: "Hecho", hr: "Završi uređivanje" },
  "calendar.export": { en: "Export", ru: "Экспорт", de: "Export", fr: "Exporter", es: "Exportar", hr: "Izvoz" },
  "calendar.guestNamePrompt": { en: "Guest name:", ru: "Имя гостя:", de: "Gastname:", fr: "Nom du voyageur :", es: "Nombre del huésped:", hr: "Ime gosta:" },
  "calendar.newReservation": { en: "New Reservation", ru: "Новая бронь", de: "Neue Reservierung", fr: "Nouvelle réservation", es: "Nueva reserva", hr: "Nova rezervacija" },
  "calendar.doubleBooking": { en: "Double booking detected!", ru: "Обнаружено двойное бронирование!", de: "Doppelbuchung erkannt!", fr: "Double réservation détectée !", es: "¡Reserva duplicada detectada!", hr: "Otkrivena dvostruka rezervacija!" },
  "calendar.overlapWarning": { en: "The same dates are booked on both Airbnb and Booking.com. This needs immediate attention.", ru: "Одни и те же даты забронированы и на Airbnb и на Booking.com. Требуется срочное внимание.", de: "Dieselben Tage sind auf Airbnb und Booking.com gebucht. Erfordert sofortige Klärung.", fr: "Les mêmes dates sont réservées sur Airbnb et Booking.com. À traiter en priorité.", es: "Las mismas fechas están reservadas en Airbnb y en Booking.com. Requiere atención inmediata.", hr: "Isti datumi rezervirani su i na Airbnbu i na Booking.comu. Potrebna je hitna pažnja." },
  "calendar.andMore": { en: "and {n} more", ru: "и ещё {n}", de: "und {n} weitere", fr: "et {n} de plus", es: "y {n} más", hr: "i još {n}" },
  "calendar.airbnbBookingOverlap": { en: "Airbnb + Booking overlap", ru: "Airbnb + Booking пересечение", de: "Airbnb + Booking überschneiden sich", fr: "Chevauchement Airbnb + Booking", es: "Solapamiento Airbnb + Booking", hr: "Preklapanje Airbnb + Booking" },
  "calendar.overrideMode": { en: "Date override mode", ru: "Режим ручного управления датами", de: "Datums-Override-Modus", fr: "Mode forçage des dates", es: "Modo override de fechas", hr: "Način ručne izmjene datuma" },
  "calendar.overrideDesc": { en: "Click any date to toggle it. Blocked/cleaning dates will be forced open. Free dates will be forced closed. Click an overridden date again to remove the override.", ru: "Нажмите на любую дату для переключения. Заблокированные/уборочные даты будут принудительно открыты. Свободные даты будут заблокированы. Повторное нажатие снимет переопределение.", de: "Auf ein Datum klicken, um es umzuschalten. Gesperrte/Reinigungstage werden zwangsweise geöffnet, freie Tage zwangsweise gesperrt. Erneut klicken hebt das Override auf.", fr: "Cliquez sur une date pour la basculer. Les dates bloquées ou de ménage seront forcées en ouverture, les dates libres en blocage. Cliquez à nouveau sur une date forcée pour retirer le forçage.", es: "Haga clic en una fecha para cambiarla. Las fechas bloqueadas o de limpieza se abrirán a la fuerza. Las fechas libres se cerrarán a la fuerza. Vuelva a hacer clic en una fecha forzada para retirar el override.", hr: "Kliknite bilo koji datum za promjenu. Blokirani dani i dani čišćenja bit će otvoreni, slobodni datumi zatvoreni. Ponovno kliknite izmijenjeni datum za uklanjanje izmjene." },
  "calendar.blockedByBooking": { en: "Cannot override — date is held by a confirmed booking from Airbnb/Booking.com", ru: "Нельзя изменить — дата занята подтверждённым бронированием Airbnb/Booking.com", de: "Override nicht möglich — Datum ist durch eine bestätigte Buchung von Airbnb/Booking.com belegt", fr: "Forçage impossible — date occupée par une réservation confirmée Airbnb/Booking.com", es: "Override no permitido — la fecha está ocupada por una reserva confirmada de Airbnb/Booking.com", hr: "Nije moguće izmijeniti — datum je zauzet potvrđenom rezervacijom s Airbnba/Booking.coma" },

  // Date actions popover
  "dateActions.title": { en: "Date actions", ru: "Действия с датой", de: "Aktionen für dieses Datum", fr: "Actions sur la date", es: "Acciones de fecha", hr: "Radnje za datum" },
  "dateActions.status": { en: "Status", ru: "Статус", de: "Status", fr: "Statut", es: "Estado", hr: "Status" },
  "dateActions.statusFree": { en: "Free", ru: "Свободно", de: "Frei", fr: "Libre", es: "Libre", hr: "Slobodno" },
  "dateActions.statusBooked": { en: "Booked by {name}", ru: "Забронировано: {name}", de: "Gebucht von {name}", fr: "Réservé par {name}", es: "Reservado por {name}", hr: "Rezervirao/la {name}" },
  "dateActions.statusCleaning": { en: "Auto cleaning day", ru: "Автоматическая уборка", de: "Automatischer Reinigungstag", fr: "Jour de ménage automatique", es: "Día de limpieza automática", hr: "Automatski dan čišćenja" },
  "dateActions.statusCleaningManual": { en: "Manual cleaning", ru: "Ручная уборка", de: "Manuelle Reinigung", fr: "Ménage manuel", es: "Limpieza manual", hr: "Ručno čišćenje" },
  "dateActions.statusClosed": { en: "Manually closed", ru: "Закрыто вручную", de: "Manuell gesperrt", fr: "Fermé manuellement", es: "Cerrado manualmente", hr: "Ručno zatvoreno" },
  "dateActions.statusOpen": { en: "Manually opened", ru: "Открыто вручную", de: "Manuell geöffnet", fr: "Ouvert manuellement", es: "Abierto manualmente", hr: "Ručno otvoreno" },
  "dateActions.statusPotential": { en: "Potential cleaning", ru: "Возможная уборка", de: "Mögliche Reinigung", fr: "Ménage potentiel", es: "Limpieza potencial", hr: "Moguće čišćenje" },
  "dateActions.statusUnbookable": { en: "Unbookable (< min nights)", ru: "Недостижимо (< мин. ночей)", de: "Nicht buchbar (< Mindestnächte)", fr: "Non réservable (< nuits min.)", es: "No reservable (< noches mín.)", hr: "Nije moguće rezervirati (manje od min. noćenja)" },
  "dateActions.close": { en: "Close date (block)", ru: "Закрыть дату (блок)", de: "Datum sperren", fr: "Fermer la date (bloquer)", es: "Cerrar fecha (bloquear)", hr: "Zatvori datum (blokiraj)" },
  "dateActions.open": { en: "Open date (unblock)", ru: "Открыть дату", de: "Datum freigeben", fr: "Ouvrir la date (débloquer)", es: "Abrir fecha (desbloquear)", hr: "Otvori datum (odblokiraj)" },
  "dateActions.addCleaning": { en: "Schedule cleaning here", ru: "Назначить уборку", de: "Reinigung hier einplanen", fr: "Planifier un ménage ici", es: "Programar limpieza aquí", hr: "Zakaži čišćenje ovdje" },
  "dateActions.removeCleaning": { en: "Remove cleaning", ru: "Убрать уборку", de: "Reinigung entfernen", fr: "Retirer le ménage", es: "Quitar limpieza", hr: "Ukloni čišćenje" },
  "dateActions.removeOverride": { en: "Remove override", ru: "Отменить переопределение", de: "Override aufheben", fr: "Retirer le forçage", es: "Retirar override", hr: "Ukloni izmjenu" },
  "dateActions.extendBooking": { en: "Extend reservation", ru: "Продлить бронь", de: "Buchung verlängern", fr: "Prolonger la réservation", es: "Ampliar reserva", hr: "Produži rezervaciju" },
  "dateActions.extendDesc": { en: "Add as direct-pay day linked to:", ru: "Добавить как день прямой оплаты к:", de: "Als Direktzahlungstag hinzufügen, verknüpft mit:", fr: "Ajouter comme jour en paiement direct, rattaché à :", es: "Añadir como día de pago directo, vinculado a:", hr: "Dodaj kao dan izravnog plaćanja povezan s:" },
  "dateActions.extensionAdded": { en: "Extension", ru: "Расширение", de: "Verlängerung", fr: "Prolongation", es: "Ampliación", hr: "Produženje" },
  "dateActions.cantModifyBooked": { en: "Real bookings cannot be modified", ru: "Реальные бронирования изменить нельзя", de: "Echte Buchungen lassen sich nicht ändern", fr: "Les réservations réelles ne peuvent pas être modifiées", es: "Las reservas reales no se pueden modificar", hr: "Stvarne rezervacije ne mogu se mijenjati" },
  "calendar.today": { en: "Today", ru: "Сегодня", de: "Heute", fr: "Aujourd'hui", es: "Hoy", hr: "Danas" },
  "calendar.airbnb": { en: "Airbnb", ru: "Airbnb", de: "Airbnb", fr: "Airbnb", es: "Airbnb", hr: "Airbnb" },
  "calendar.booking": { en: "Booking", ru: "Booking", de: "Booking", fr: "Booking", es: "Booking", hr: "Booking" },
  "calendar.cleaning": { en: "Cleaning", ru: "Уборка", de: "Reinigung", fr: "Ménage", es: "Limpieza", hr: "Čišćenje" },
  "calendar.manualCleaning": { en: "Manual cleaning", ru: "Ручная уборка", de: "Manuelle Reinigung", fr: "Ménage manuel", es: "Limpieza manual", hr: "Ručno čišćenje" },
  "calendar.potentialCleaning": { en: "Potential cleaning", ru: "Возможная уборка", de: "Mögliche Reinigung", fr: "Ménage potentiel", es: "Limpieza potencial", hr: "Moguće čišćenje" },
  "calendar.forcedOpen": { en: "Forced open", ru: "Принуд. открыто", de: "Erzwungen offen", fr: "Ouvert (forcé)", es: "Abierto (forzado)", hr: "Ručno otvoreno" },
  "calendar.forcedClosed": { en: "Forced closed", ru: "Принуд. закрыто", de: "Erzwungen gesperrt", fr: "Fermé (forcé)", es: "Cerrado (forzado)", hr: "Ručno zatvoreno" },
  "calendar.open": { en: "Open", ru: "Откр.", de: "Offen", fr: "Ouvert", es: "Abierto", hr: "Otvoreno" },
  "calendar.closed": { en: "Closed", ru: "Закр.", de: "Gesperrt", fr: "Fermé", es: "Cerrado", hr: "Zatvoreno" },
  "calendar.directPerGuest": { en: "Direct (one colour per guest)", ru: "Напрямую (свой цвет у каждого гостя)", de: "Direkt (eine Farbe je Gast)", fr: "Direct (une couleur par hôte)", es: "Directa (un color por huésped)", hr: "Izravno (jedna boja po gostu)" },
  "calendar.blocked": { en: "Blocked", ru: "Блок", de: "Blockiert", fr: "Bloqué", es: "Bloqueado", hr: "Blokirano" },
  "calendar.conflict": { en: "Conflict", ru: "Конфликт", de: "Konflikt", fr: "Conflit", es: "Conflicto", hr: "Sukob" },
  "calendar.cleaningQ": { en: "Cleaning?", ru: "Уборка?", de: "Reinigung?", fr: "Ménage ?", es: "¿Limpieza?", hr: "Čišćenje?" },
  "calendar.upcoming": { en: "Upcoming", ru: "Предстоящие", de: "Anstehend", fr: "À venir", es: "Próximas", hr: "Nadolazeće" },
  "calendar.noUpcoming": { en: "No upcoming bookings", ru: "Нет предстоящих бронирований", de: "Keine anstehenden Buchungen", fr: "Aucune réservation à venir", es: "No hay reservas próximas", hr: "Nema nadolazećih rezervacija" },
  "calendar.next7Days": { en: "Next 7 days", ru: "Ближайшие 7 дней", de: "Nächste 7 Tage", fr: "7 prochains jours", es: "Próximos 7 días", hr: "Sljedećih 7 dana" },
  "calendar.later": { en: "Later", ru: "Позже", de: "Später", fr: "Plus tard", es: "Más adelante", hr: "Kasnije" },

  // Cleaning schedule
  "cleaning.overlapWarning": { en: "Cleaning overlap!", ru: "Пересечение уборок!", de: "Reinigungs-Überschneidung!", fr: "Chevauchement de ménages !", es: "¡Solapamiento de limpiezas!", hr: "Preklapanje čišćenja!" },
  "cleaning.overlapDesc": { en: "Multiple properties need cleaning on the same day. With one cleaner, consider rescheduling.", ru: "Несколько объектов нуждаются в уборке в один день. При одном уборщике стоит перенести.", de: "Mehrere Unterkünfte brauchen am selben Tag eine Reinigung. Bei nur einer Reinigungskraft sollten Sie verschieben.", fr: "Plusieurs logements doivent être nettoyés le même jour. Avec un seul agent d'entretien, mieux vaut décaler.", es: "Varios alojamientos necesitan limpieza el mismo día. Si tiene un solo limpiador, considere reprogramar.", hr: "Više nekretnina treba čišćenje isti dan. S jednom čistačicom razmislite o pomicanju termina." },
  "cleaning.moveTo": { en: "Move one cleaning to {date}", ru: "Перенести одну уборку на {date}", de: "Eine Reinigung auf {date} verschieben", fr: "Déplacer un ménage au {date}", es: "Mover una limpieza al {date}", hr: "Pomakni jedno čišćenje na {date}" },
  "cleaning.noFreeDay": { en: "No adjacent free day available", ru: "Нет свободного соседнего дня", de: "Kein freier Nachbartag verfügbar", fr: "Aucun jour libre adjacent disponible", es: "No hay día libre adyacente disponible", hr: "Nema slobodnog dana u blizini" },
  "cleaning.title": { en: "Cleaning Schedule", ru: "График уборок", de: "Reinigungsplan", fr: "Planning de ménage", es: "Calendario de limpieza", hr: "Raspored čišćenja" },
  "cleaning.upcoming": { en: "upcoming", ru: "предстоящих", de: "anstehend", fr: "à venir", es: "próximas", hr: "nadolazeće" },
  "cleaning.noUpcoming": { en: "No upcoming cleaning days", ru: "Нет предстоящих уборок", de: "Keine anstehenden Reinigungstage", fr: "Aucun jour de ménage à venir", es: "No hay días de limpieza próximos", hr: "Nema nadolazećih dana čišćenja" },
  "cleaning.date": { en: "Date", ru: "Дата", de: "Datum", fr: "Date", es: "Fecha", hr: "Datum" },
  "cleaning.type": { en: "Type", ru: "Тип", de: "Typ", fr: "Type", es: "Tipo", hr: "Vrsta" },
  "cleaning.property": { en: "Property", ru: "Объект", de: "Unterkunft", fr: "Logement", es: "Alojamiento", hr: "Nekretnina" },
  "cleaning.reason": { en: "Reason", ru: "Причина", de: "Grund", fr: "Motif", es: "Motivo", hr: "Razlog" },
  "cleaning.typeClean": { en: "Cleaning", ru: "Уборка", de: "Reinigung", fr: "Ménage", es: "Limpieza", hr: "Čišćenje" },
  "cleaning.typePotential": { en: "Potential", ru: "Возможная", de: "Möglich", fr: "Potentiel", es: "Potencial", hr: "Moguće" },
  "cleaning.overlap": { en: "overlap", ru: "пересечение", de: "Überschneidung", fr: "chevauchement", es: "solapamiento", hr: "preklapanje" },
  "cleaning.copySchedule": { en: "Copy", ru: "Скопировать", de: "Kopieren", fr: "Copier", es: "Copiar", hr: "Kopiraj" },
  "cleaning.printSchedule": { en: "Print", ru: "Печать", de: "Drucken", fr: "Imprimer", es: "Imprimir", hr: "Ispiši" },
  "cleaning.includePotential": { en: "Include potential", ru: "Включая возможные", de: "Mögliche einbeziehen", fr: "Inclure les potentiels", es: "Incluir potenciales", hr: "Uključi moguća" },
  "cleaning.notes": { en: "Notes", ru: "Заметки", de: "Notizen", fr: "Notes", es: "Notas", hr: "Bilješke" },
  "cleaning.hoursAvailable": { en: "{h}h available", ru: "{h}ч доступно", de: "{h} Std. verfügbar", fr: "{h} h disponibles", es: "{h} h disponibles", hr: "{h} h na raspolaganju" },
  "cleaning.skip": { en: "Skip", ru: "Пропустить", de: "Überspringen", fr: "Passer", es: "Omitir", hr: "Preskoči" },
  "cleaning.addManual": { en: "Add manual cleaning", ru: "Добавить уборку", de: "Manuelle Reinigung hinzufügen", fr: "Ajouter un ménage manuel", es: "Añadir limpieza manual", hr: "Dodaj ručno čišćenje" },
  "cleaning.addManualNote": { en: "Note (optional)", ru: "Заметка (необязательно)", de: "Notiz (optional)", fr: "Note (facultatif)", es: "Nota (opcional)", hr: "Bilješka (nije obavezno)" },
  "cleaning.manual": { en: "Manual", ru: "Вручную", de: "Manuell", fr: "Manuel", es: "Manual", hr: "Ručno" },
  "cleaning.actions": { en: "Actions", ru: "Действия", de: "Aktionen", fr: "Actions", es: "Acciones", hr: "Radnje" },
  "cleaning.afterGuest": { en: "After {name}", ru: "После {name}", de: "Nach {name}", fr: "Après {name}", es: "Después de {name}", hr: "Nakon {name}" },
  "cleaning.afterGuestFull": { en: "After {name} (checked out {date})", ru: "После {name} (выезд {date})", de: "Nach {name} (Check-out {date})", fr: "Après {name} (départ le {date})", es: "Después de {name} (salida {date})", hr: "Nakon {name} (odjava {date})" },
  "cleaning.afterGuestQuick": { en: "After {name} checkout", ru: "После выезда {name}", de: "Nach Check-out von {name}", fr: "Après le départ de {name}", es: "Tras la salida de {name}", hr: "Nakon odjave {name}" },
  "cleaning.afterGuestQuickWithNext": { en: "After {name}; {next} arrives {date}", ru: "После {name}; {next} заезжает {date}", de: "Nach {name}; {next} reist am {date} an", fr: "Après {name} ; {next} arrive le {date}", es: "Después de {name}; {next} llega el {date}", hr: "Nakon {name}; {next} stiže {date}" },
  "cleaning.beforeGuest": { en: "Before {name}", ru: "Перед {name}", de: "Vor {name}", fr: "Avant {name}", es: "Antes de {name}", hr: "Prije {name}" },
  "cleaning.beforeGuestFull": { en: "Before {name} (arrives {date})", ru: "Перед {name} (заезд {date})", de: "Vor {name} (Anreise {date})", fr: "Avant {name} (arrivée le {date})", es: "Antes de {name} (llegada el {date})", hr: "Prije {name} (stiže {date})" },
  "cleaning.turnover": { en: "Turnover: {from} → {to} (same day)", ru: "Смена гостей: {from} → {to} (в один день)", de: "Wechsel: {from} → {to} (am selben Tag)", fr: "Rotation : {from} → {to} (le même jour)", es: "Cambio: {from} → {to} (el mismo día)", hr: "Smjena: {from} → {to} (isti dan)" },
  "cleaning.gapPotential": { en: "If gap booked → before {name}", ru: "Если промежуток занят → перед {name}", de: "Wird Lücke gebucht → vor {name}", fr: "Si l'intervalle est réservé → avant {name}", es: "Si se reserva el hueco → antes de {name}", hr: "Ako se rupa popuni → prije {name}" },
  "cleaning.gapPotentialSpecific": { en: "If {gap} gets booked → cleaning before {name} ({date})", ru: "Если занят {gap} → уборка перед {name} ({date})", de: "Wird {gap} gebucht → Reinigung vor {name} ({date})", fr: "Si {gap} est réservé → ménage avant {name} ({date})", es: "Si se reserva {gap} → limpieza antes de {name} ({date})", hr: "Ako se {gap} rezervira → čišćenje prije {name} ({date})" },
  "cleaning.manualCleaning": { en: "Added manually", ru: "Добавлено вручную", de: "Manuell hinzugefügt", fr: "Ajouté manuellement", es: "Añadida manualmente", hr: "Dodano ručno" },
  // RT-25.3 — per-property cleaning master toggle
  "cleaning.toggleLabel": { en: "Show cleaning logic for this property", ru: "Показывать логику уборок для этого объекта", de: "Reinigungslogik für diese Unterkunft anzeigen", fr: "Afficher la logique de ménage pour ce logement", es: "Mostrar la lógica de limpieza para este alojamiento", hr: "Prikaži logiku čišćenja za ovu nekretninu" },
  "cleaning.toggleHint": { en: "When off, buffer days, turnovers, and potential cleanings are hidden. Conflicts and bookings still appear.", ru: "Когда выключено, буферные дни, смены и возможные уборки скрыты. Конфликты и бронирования по-прежнему отображаются.", de: "Wenn deaktiviert, werden Puffertage, Wechsel und mögliche Reinigungen ausgeblendet. Konflikte und Buchungen bleiben sichtbar.", fr: "Lorsque désactivée, les jours tampons, rotations et ménages potentiels sont masqués. Les conflits et réservations restent visibles.", es: "Si está desactivada, se ocultan los días tampón, los cambios y las limpiezas potenciales. Los conflictos y las reservas siguen visibles.", hr: "Kad je isključeno, dani pauze, smjene i moguća čišćenja su skriveni. Sukobi i rezervacije i dalje se prikazuju." },
  "cleaning.offTitle": { en: "Cleaning is off for this property", ru: "Уборки отключены для этого объекта", de: "Reinigung ist für diese Unterkunft deaktiviert", fr: "Le ménage est désactivé pour ce logement", es: "La limpieza está desactivada para este alojamiento", hr: "Čišćenje je isključeno za ovu nekretninu" },
  "cleaning.offDesc": { en: "Turn the toggle on to bring cleaning chips and the schedule back. No data is lost while it is off.", ru: "Включите переключатель, чтобы вернуть отметки уборок и расписание. Данные при выключении не теряются.", de: "Aktivieren Sie den Schalter, um Reinigungs-Chips und den Plan wiederherzustellen. Während der Deaktivierung gehen keine Daten verloren.", fr: "Activez l'interrupteur pour réafficher les marqueurs de ménage et le planning. Aucune donnée n'est perdue pendant la désactivation.", es: "Active el interruptor para recuperar las marcas de limpieza y el calendario. No se pierde ningún dato mientras está desactivada.", hr: "Uključite prekidač da se oznake čišćenja i raspored vrate. Dok je isključeno, ništa se ne gubi." },
  "cleaning.fullDay": { en: "Full day", ru: "Полный день", de: "Ganzer Tag", fr: "Journée entière", es: "Día completo", hr: "Cijeli dan" },
  "cleaning.quickTurnover": { en: "Quick", ru: "Быстрая", de: "Schnell", fr: "Rapide", es: "Rápida", hr: "Brzo" },
  "cleaning.hoursShort": { en: "{h}h", ru: "{h}ч", de: "{h} Std.", fr: "{h} h", es: "{h} h", hr: "{h} h" },
  "cleaning.daysShort": { en: "~{d} day(s)", ru: "~{d} дн.", de: "~{d} Tag(e)", fr: "~{d} j.", es: "~{d} día(s)", hr: "~{d} d" },
  "cleaning.dateFullyBooked": { en: "This date is fully booked by a guest — no cleaning window available.", ru: "Эта дата полностью занята гостем — нет окна для уборки.", de: "Dieses Datum ist komplett von einem Gast belegt — kein Reinigungsfenster verfügbar.", fr: "Cette date est entièrement réservée par un voyageur — aucun créneau de ménage disponible.", es: "Esta fecha está totalmente ocupada por un huésped — no hay ventana de limpieza disponible.", hr: "Ovaj je datum u cijelosti rezerviran — nema prozora za čišćenje." },
  // RT-25.10 tick 3 — cleaner-conflict warning surfaces when the same
  // cleaner is the priority-0 default for multiple properties on the
  // same cleaning date.
  "cleaning.cleanerConflict": { en: "Cleaner conflict", ru: "Конфликт уборщика", de: "Reinigungskraft-Konflikt", fr: "Conflit d'agent d'entretien", es: "Conflicto de limpiador", hr: "Sukob čistačice" },
  "cleaning.cleanerConflictShort": { en: "cleaner conflict", ru: "конфликт уборщика", de: "Reinigungskraft-Konflikt", fr: "conflit d'agent d'entretien", es: "conflicto de limpiador", hr: "sukob čistačice" },
  "cleaning.cleanerConflictDesc": { en: "One cleaner is the default for multiple properties on the same day. Decide whether to swap to a backup or move one of the cleanings.", ru: "Один уборщик назначен по умолчанию на нескольких объектах в один день. Решите, заменить ли его на резерв или перенести одну из уборок.", de: "Eine Reinigungskraft ist Standard für mehrere Unterkünfte am selben Tag. Entscheiden Sie, ob Sie auf eine Vertretung wechseln oder eine der Reinigungen verschieben.", fr: "Un agent d'entretien est attribué par défaut à plusieurs logements le même jour. Choisissez de basculer sur un remplaçant ou de décaler l'un des ménages.", es: "Un mismo limpiador está asignado por defecto a varios alojamientos el mismo día. Decida si cambiar a un suplente o mover una de las limpiezas.", hr: "Ista je čistačica zadana za više nekretnina istog dana. Odlučite hoćete li uzeti zamjenu ili pomaknuti jedno čišćenje." },
  "cleaning.cleanerConflictLine": { en: "{name} has {count} cleanings — {properties}", ru: "У {name} {count} уборок — {properties}", de: "{name} hat {count} Reinigungen — {properties}", fr: "{name} a {count} ménages — {properties}", es: "{name} tiene {count} limpiezas — {properties}", hr: "{name} ima {count} čišćenja — {properties}" },
  "cleaning.backupSet": { en: "Backup for {property}: {name}", ru: "Резерв для {property}: {name}", de: "Vertretung für {property}: {name}", fr: "Remplaçant pour {property} : {name}", es: "Suplente para {property}: {name}", hr: "Zamjena za {property}: {name}" },
  "cleaning.backupBusy": { en: "Backup for {property}: {name} (also booked)", ru: "Резерв для {property}: {name} (тоже занят)", de: "Vertretung für {property}: {name} (ebenfalls belegt)", fr: "Remplaçant pour {property} : {name} (également pris)", es: "Suplente para {property}: {name} (también ocupado)", hr: "Zamjena za {property}: {name} (također zauzeta)" },
  "cleaning.backupNone": { en: "No backup configured for {property}", ru: "Резерв не настроен для {property}", de: "Keine Vertretung für {property} eingerichtet", fr: "Aucun remplaçant configuré pour {property}", es: "Sin suplente configurado para {property}", hr: "Za {property} nije određena zamjena" },

  // Reservation view
  "reservation.dropPassport": { en: "Drop passport documents", ru: "Перетащите документы с паспортами", de: "Pass-Dokumente hier ablegen", fr: "Déposez les documents de passeport", es: "Suelte los documentos de pasaporte", hr: "Ispustite dokumente putovnice" },
  "reservation.dropHere": { en: "Drop here...", ru: "Перетащите сюда...", de: "Hier ablegen...", fr: "Déposez ici...", es: "Suelte aquí...", hr: "Ispustite ovdje..." },
  "reservation.clear": { en: "Clear", ru: "Очистить", de: "Leeren", fr: "Effacer", es: "Limpiar", hr: "Očisti" },
  "reservation.extract": { en: "Extract", ru: "Извлечь", de: "Auslesen", fr: "Extraire", es: "Extraer", hr: "Izdvoji" },
  "reservation.extracting": { en: "Extracting...", ru: "Извлечение...", de: "Wird ausgelesen...", fr: "Extraction en cours...", es: "Extrayendo...", hr: "Izdvajanje..." },
  "reservation.extractionLog": { en: "Extraction Log", ru: "Лог извлечения", de: "Auslese-Log", fr: "Journal d'extraction", es: "Registro de extracción", hr: "Zapis izdvajanja" },
  "reservation.guests": { en: "guest", ru: "гость", de: "Gast", fr: "voyageur", es: "huésped", hr: "gost" },
  "reservation.guestsPlural": { en: "guests", ru: "гостей", de: "Gäste", fr: "voyageurs", es: "huéspedes", hr: "gostiju" },
  "reservation.edit": { en: "Edit reservation", ru: "Редактировать бронь", de: "Reservierung bearbeiten", fr: "Modifier la réservation", es: "Editar reserva", hr: "Uredi rezervaciju" },
  "reservation.editDates": { en: "Edit dates", ru: "Изменить даты", de: "Daten ändern", fr: "Modifier les dates", es: "Cambiar fechas", hr: "Uredi datume" },
  "reservation.editDescription": { en: "Change the guest name or stay dates without recreating the booking.", ru: "Измените имя гостя или даты проживания без удаления брони.", de: "Ändern Sie den Gastnamen oder die Aufenthaltsdaten, ohne die Buchung neu anzulegen.", fr: "Modifiez le nom du voyageur ou les dates du séjour sans recréer la réservation.", es: "Cambie el nombre del huésped o las fechas sin volver a crear la reserva.", hr: "Promijenite ime gosta ili datume boravka bez ponovnog stvaranja rezervacije." },
  "reservation.name": { en: "Guest name", ru: "Имя гостя", de: "Gastname", fr: "Nom du voyageur", es: "Nombre del huésped", hr: "Ime gosta" },
  "reservation.checkIn": { en: "Check-in", ru: "Заезд", de: "Check-in", fr: "Arrivée", es: "Entrada", hr: "Prijava" },
  "reservation.checkOut": { en: "Check-out", ru: "Выезд", de: "Check-out", fr: "Départ", es: "Salida", hr: "Odjava" },
  "reservation.saving": { en: "Saving…", ru: "Сохраняю…", de: "Wird gespeichert…", fr: "Enregistrement…", es: "Guardando…", hr: "Spremanje…" },
  "reservation.dateRangeRequired": { en: "Choose both check-in and check-out dates.", ru: "Выберите даты заезда и выезда.", de: "Wählen Sie Check-in- und Check-out-Datum.", fr: "Choisissez les dates d’arrivée et de départ.", es: "Elija las fechas de entrada y salida.", hr: "Odaberite datum prijave i odjave." },
  "reservation.invalidCheckIn": { en: "Choose a valid check-in date.", ru: "Выберите корректную дату заезда.", de: "Wählen Sie ein gültiges Check-in-Datum.", fr: "Choisissez une date d’arrivée valide.", es: "Elija una fecha de entrada válida.", hr: "Odaberite valjan datum prijave." },
  "reservation.invalidCheckOut": { en: "Choose a valid check-out date.", ru: "Выберите корректную дату выезда.", de: "Wählen Sie ein gültiges Check-out-Datum.", fr: "Choisissez une date de départ valide.", es: "Elija una fecha de salida válida.", hr: "Odaberite valjan datum odjave." },
  "reservation.invalidDateRange": { en: "Check-out must be after check-in.", ru: "Дата выезда должна быть позже даты заезда.", de: "Der Check-out muss nach dem Check-in liegen.", fr: "Le départ doit être postérieur à l’arrivée.", es: "La salida debe ser posterior a la entrada.", hr: "Odjava mora biti nakon prijave." },
  "reservation.manualOverlap": { en: "These dates overlap another reservation.", ru: "Эти даты пересекаются с другой бронью.", de: "Diese Daten überschneiden sich mit einer anderen Reservierung.", fr: "Ces dates chevauchent une autre réservation.", es: "Estas fechas se solapan con otra reserva.", hr: "Ovi se datumi preklapaju s drugom rezervacijom." },
  "reservation.syncedOverlap": { en: "These dates overlap a booking from a synced calendar.", ru: "Эти даты пересекаются с бронью из синхронизированного календаря.", de: "Diese Daten überschneiden sich mit einer Buchung aus einem synchronisierten Kalender.", fr: "Ces dates chevauchent une réservation d’un calendrier synchronisé.", es: "Estas fechas se solapan con una reserva de un calendario sincronizado.", hr: "Ovi se datumi preklapaju s rezervacijom iz sinkroniziranog kalendara." },
  "reservation.linkedRelationship": { en: "These dates would break the link to the synced booking. Keep a manual extension adjacent to the source booking, or keep a claimed booking overlapping its source dates.", ru: "Эти даты нарушат связь с синхронизированной бронью. Ручное продление должно примыкать к исходной брони, а привязанная бронь — пересекать её исходные даты.", de: "Diese Daten würden die Verknüpfung mit der synchronisierten Buchung aufheben. Eine manuelle Verlängerung muss direkt angrenzen; eine übernommene Buchung muss ihre Quelldaten weiterhin überlappen.", fr: "Ces dates rompraient le lien avec la réservation synchronisée. Une extension manuelle doit rester adjacente ; une réservation associée doit continuer à chevaucher ses dates source.", es: "Estas fechas romperían el vínculo con la reserva sincronizada. Una ampliación manual debe seguir siendo adyacente; una reserva vinculada debe continuar solapándose con sus fechas de origen.", hr: "Ovi bi datumi prekinuli vezu sa sinkroniziranom rezervacijom. Ručno produženje držite uz izvornu rezervaciju, a preuzetu rezervaciju u preklapanju s izvornim datumima." },
  "reservation.syncedDateHint": { en: "This booking is linked to a synced calendar. Date corrections are saved in RentTools; update the source platform separately if needed.", ru: "Бронь связана с синхронизированным календарём. Изменение сохранится в RentTools; при необходимости отдельно обновите даты на исходной площадке.", de: "Diese Buchung ist mit einem synchronisierten Kalender verknüpft. Datumskorrekturen werden in RentTools gespeichert; aktualisieren Sie bei Bedarf auch die Quellplattform.", fr: "Cette réservation est liée à un calendrier synchronisé. Les corrections sont enregistrées dans RentTools ; mettez aussi à jour la plateforme source si nécessaire.", es: "Esta reserva está vinculada a un calendario sincronizado. Las correcciones se guardan en RentTools; actualice también la plataforma de origen si es necesario.", hr: "Ova je rezervacija povezana sa sinkroniziranim kalendarom. Ispravci datuma spremaju se u RentTools; po potrebi zasebno ažurirajte izvornu platformu." },
  "reservation.directExtension": { en: "Direct extension", ru: "Прямое продление", de: "Direkte Verlängerung", fr: "Extension directe", es: "Ampliación directa", hr: "Izravno produženje" },
  "reservation.connectedToSource": { en: "Added manually to the {platform} reservation", ru: "Добавлено вручную к брони из {platform}", de: "Manuell zur {platform}-Reservierung hinzugefügt", fr: "Ajouté manuellement à la réservation {platform}", es: "Añadido manualmente a la reserva de {platform}", hr: "Ručno dodano rezervaciji s platforme {platform}" },
  "reservation.extensionSafetyHint": { en: "These dates are a separate Direct segment. Cancelling it leaves the original synced reservation unchanged.", ru: "Эти даты сохранены отдельным сегментом Direct. При отмене исходная синхронизированная бронь не изменится.", de: "Diese Daten sind ein separater Direct-Abschnitt. Beim Stornieren bleibt die ursprüngliche synchronisierte Reservierung unverändert.", fr: "Ces dates forment un segment Direct séparé. Son annulation ne modifie pas la réservation synchronisée d’origine.", es: "Estas fechas son un segmento Direct independiente. Al cancelarlo, la reserva sincronizada original no cambia.", hr: "Ovi su datumi zaseban izravni dio. Otkazivanje ostavlja izvornu sinkroniziranu rezervaciju nepromijenjenom." },
  "reservation.cancelExtension": { en: "Cancel extension", ru: "Отменить продление", de: "Verlängerung stornieren", fr: "Annuler l’extension", es: "Cancelar ampliación", hr: "Otkaži produženje" },
  "reservation.cancelExtensionConfirm": { en: "Cancel the Direct extension for \"{name}\"? The manually added dates and any details attached to this Direct segment will be removed. The original {platform} reservation will stay.", ru: "Отменить прямое продление для «{name}»? Удалятся добавленные вручную даты и данные, прикреплённые к этому сегменту Direct. Исходная бронь из {platform} останется.", de: "Direkte Verlängerung für „{name}“ stornieren? Die manuell hinzugefügten Daten und alle Details dieses Direct-Abschnitts werden entfernt. Die ursprüngliche {platform}-Reservierung bleibt bestehen.", fr: "Annuler l’extension directe de « {name} » ? Les dates ajoutées manuellement et les informations liées à ce segment Direct seront supprimées. La réservation {platform} d’origine restera intacte.", es: "¿Cancelar la ampliación directa de «{name}»? Se eliminarán las fechas añadidas manualmente y los datos asociados a este segmento Direct. La reserva original de {platform} se conservará.", hr: "Otkazati izravno produženje za „{name}”? Ručno dodani datumi i svi podaci vezani uz ovaj izravni dio bit će uklonjeni. Izvorna rezervacija s platforme {platform} ostaje." },
  "reservation.cancelExtensionFailed": { en: "Couldn’t cancel the extension. Try again.", ru: "Не удалось отменить продление. Попробуйте ещё раз.", de: "Die Verlängerung konnte nicht storniert werden. Versuchen Sie es erneut.", fr: "Impossible d’annuler l’extension. Réessayez.", es: "No se pudo cancelar la ampliación. Inténtelo de nuevo.", hr: "Otkazivanje produženja nije uspjelo. Pokušajte ponovno." },
  "reservation.saveFailed": { en: "Couldn’t update the reservation. Try again.", ru: "Не удалось обновить бронь. Попробуйте ещё раз.", de: "Die Reservierung konnte nicht aktualisiert werden. Versuchen Sie es erneut.", fr: "Impossible de mettre à jour la réservation. Réessayez.", es: "No se pudo actualizar la reserva. Inténtelo de nuevo.", hr: "Ažuriranje rezervacije nije uspjelo. Pokušajte ponovno." },
  // RT-25.12 — per-guest free-text notes
  "guest.notes": { en: "Notes", ru: "Заметки", de: "Notizen", fr: "Notes", es: "Notas", hr: "Bilješke" },
  "guest.notesPlaceholder": { en: "Allergic to nuts, requested late check-in…", ru: "Аллергия на орехи, поздний заезд…", de: "Nussallergie, später Check-in gewünscht…", fr: "Allergie aux fruits à coque, arrivée tardive demandée…", es: "Alergia a los frutos secos, solicitó entrada tardía…", hr: "Alergija na orašaste plodove, traži kasniju prijavu…" },
  // RT-25.13 — per-guest phone for WhatsApp / Telegram quick-message buttons
  "guest.phone": { en: "Phone", ru: "Телефон", de: "Telefon", fr: "Téléphone", es: "Teléfono", hr: "Telefon" },
  "guest.phonePlaceholder": { en: "+998901234567", ru: "+998901234567", de: "+998901234567", fr: "+998901234567", es: "+998901234567", hr: "+385911234567" },
  "guest.phoneHelp": { en: "Used for the WhatsApp / Telegram quick-message buttons.", ru: "Используется для кнопок быстрого сообщения в WhatsApp и Telegram.", de: "Wird für die WhatsApp- und Telegram-Schnellnachricht-Buttons verwendet.", fr: "Utilisé pour les boutons de message rapide WhatsApp et Telegram.", es: "Se usa para los botones de mensaje rápido de WhatsApp y Telegram.", hr: "Koristi se za brze poruke na WhatsAppu i Telegramu." },
  "guest.phoneInvalid": { en: "Phone must start with + and contain 7-15 digits.", ru: "Телефон должен начинаться с + и содержать 7-15 цифр.", de: "Telefonnummer muss mit + beginnen und 7–15 Ziffern enthalten.", fr: "Le téléphone doit commencer par + et contenir 7 à 15 chiffres.", es: "El teléfono debe empezar por + y contener entre 7 y 15 dígitos.", hr: "Telefon mora počinjati s + i imati 7-15 znamenki." },
  "guest.messageOnWhatsApp": { en: "Message on WhatsApp", ru: "Написать в WhatsApp", de: "Nachricht über WhatsApp", fr: "Écrire sur WhatsApp", es: "Mensaje por WhatsApp", hr: "Poruka na WhatsAppu" },
  "guest.messageOnTelegram": { en: "Message on Telegram", ru: "Написать в Telegram", de: "Nachricht über Telegram", fr: "Écrire sur Telegram", es: "Mensaje por Telegram", hr: "Poruka na Telegramu" },
  "guest.messengerPrefill": { en: "Hi {name} — this is {property}, your check-in is on {checkIn}.", ru: "Здравствуйте, {name}! Это {property}, ваш заезд {checkIn}.", de: "Hallo {name}, hier ist {property} — Ihr Check-in ist am {checkIn}.", fr: "Bonjour {name}, ici {property} — votre arrivée est prévue le {checkIn}.", es: "Hola {name}, le escribimos desde {property}: su entrada es el {checkIn}.", hr: "Pozdrav {name} — ovo je {property}, vaša je prijava {checkIn}." },
  // RT-25.13 tick 2 — per-reservation "Send group invite" CTA
  "reservation.sendGroupInvite": { en: "Send group invite", ru: "Отправить приглашение в группу", de: "Gruppeneinladung senden", fr: "Envoyer l'invitation au groupe", es: "Enviar invitación al grupo", hr: "Pošalji grupnu pozivnicu" },
  "reservation.sendGroupInviteVia": { en: "Send via {platform}", ru: "Отправить через {platform}", de: "Über {platform} senden", fr: "Envoyer via {platform}", es: "Enviar por {platform}", hr: "Pošalji putem {platform}" },
  "reservation.sendGroupInviteNoPhone": { en: "Add a phone to a guest to enable group invites", ru: "Добавьте телефон гостю, чтобы включить приглашение в группу", de: "Telefonnummer eines Gasts hinzufügen, um Gruppeneinladungen zu aktivieren", fr: "Ajoutez un téléphone à un voyageur pour activer les invitations de groupe", es: "Añada un teléfono a un huésped para activar las invitaciones al grupo", hr: "Dodajte telefon gostu za grupne pozivnice" },
  "reservation.sendGroupInvitePrefill": {
    en: "Group for your stay: {groupName}\n\n{url}",
    ru: "Группа на время вашего проживания: {groupName}\n\n{url}",
    de: "Gruppe für Ihren Aufenthalt: {groupName}\n\n{url}",
    fr: "Groupe pour votre séjour : {groupName}\n\n{url}",
    es: "Grupo para su estancia: {groupName}\n\n{url}",
  },

  // Settings
  "settings.title": { en: "Settings", ru: "Настройки", de: "Einstellungen", fr: "Paramètres", es: "Ajustes", hr: "Postavke" },
  "settings.subtitle": { en: "Manage API keys and users", ru: "Управление API ключами и пользователями", de: "API-Schlüssel und Benutzer verwalten", fr: "Gérer les clés API et les utilisateurs", es: "Gestione claves de API y usuarios", hr: "Upravljanje API ključevima i korisnicima" },
  "settings.geminiKey": { en: "Gemini API Key", ru: "API ключ Gemini", de: "Gemini-API-Schlüssel", fr: "Clé API Gemini", es: "Clave de API de Gemini", hr: "Gemini API ključ" },
  "settings.geminiPlaceholder": { en: "Enter Gemini API key...", ru: "Введите API ключ Gemini...", de: "Gemini-API-Schlüssel eingeben...", fr: "Saisissez la clé API Gemini...", es: "Introduzca la clave de API de Gemini...", hr: "Unesite Gemini API ključ..." },
  "settings.saving": { en: "Saving...", ru: "Сохранение...", de: "Wird gespeichert...", fr: "Enregistrement...", es: "Guardando...", hr: "Spremanje..." },
  "settings.notConfigured": { en: "Not configured", ru: "Не настроено", de: "Nicht konfiguriert", fr: "Non configuré", es: "Sin configurar", hr: "Nije postavljeno" },
  "settings.users": { en: "Users", ru: "Пользователи", de: "Benutzer", fr: "Utilisateurs", es: "Usuarios", hr: "Korisnici" },
  "settings.username": { en: "Username", ru: "Логин", de: "Benutzername", fr: "Identifiant", es: "Usuario", hr: "Korisničko ime" },
  "settings.passwordLabel": { en: "Password", ru: "Пароль", de: "Passwort", fr: "Mot de passe", es: "Contraseña", hr: "Lozinka" },
  "settings.addUser": { en: "Add User", ru: "Добавить пользователя", de: "Benutzer hinzufügen", fr: "Ajouter un utilisateur", es: "Añadir usuario", hr: "Dodaj korisnika" },
  "settings.loginLinkOnce": { en: "One-time link", de: "Einmal-Link", hr: "Jednokratni link" },
  "settings.loginLinkFamily": { en: "Family link", de: "Familien-Link", hr: "Obiteljski link" },
  "settings.loginLinkFor": { en: "Login link for {name}", de: "Anmeldelink für {name}", hr: "Link za prijavu za {name}" },
  "settings.loginLinkOnceHint": { en: "Valid 30 minutes · single use", de: "30 Minuten gültig · einmal verwendbar", hr: "Vrijedi 30 minuta · jednokratno" },
  "settings.loginLinkFamilyHint": { en: "Valid 90 days · reusable · anyone holding the link signs in as this user", de: "90 Tage gültig · mehrfach verwendbar · wer den Link hat, ist als dieser Benutzer angemeldet", hr: "Vrijedi 90 dana · višekratno · tko ima link, prijavljen je kao ovaj korisnik" },
  "settings.loginLinkLanguage": { en: "Language after sign-in", de: "Sprache nach der Anmeldung", hr: "Jezik nakon prijave" },
  "settings.loginLinkRevoke": { en: "Revoke all links for {name}", de: "Alle Links für {name} zurückziehen", hr: "Opozovi sve linkove za {name}" },
  "settings.loginLinkRevoked": { en: "Links revoked", de: "Links zurückgezogen", hr: "Linkovi opozvani" },
  "settings.role": { en: "Role", ru: "Роль", de: "Rolle", fr: "Rôle", es: "Rol", hr: "Uloga" },
  "settings.created": { en: "Created", ru: "Создан", de: "Erstellt", fr: "Créé", es: "Creado", hr: "Stvoreno" },
  "settings.language": { en: "Language", ru: "Язык", de: "Sprache", fr: "Langue", es: "Idioma", hr: "Jezik" },

  // Tasks
  "tasks.title": { en: "Tasks", ru: "Задачи", de: "Aufgaben", fr: "Tâches", es: "Tareas", hr: "Zadaci" },
  "tasks.subtitle": { en: "Calendar sync scheduler and logs", ru: "Планировщик синхронизации и логи", de: "Planer und Logs der Kalendersynchronisation", fr: "Planificateur de synchronisation et journaux", es: "Planificador de sincronización de calendarios y registros", hr: "Raspoređivač sinkronizacije kalendara i zapisi" },
  "tasks.runSync": { en: "Run Sync Now", ru: "Синхронизировать", de: "Jetzt synchronisieren", fr: "Synchroniser maintenant", es: "Sincronizar ahora", hr: "Pokreni sinkronizaciju" },
  "tasks.syncing": { en: "Syncing...", ru: "Синхронизация...", de: "Synchronisiere...", fr: "Synchronisation...", es: "Sincronizando...", hr: "Sinkronizacija..." },
  "tasks.autoSync": { en: "Automatic Sync", ru: "Автоматическая синхронизация", de: "Automatische Synchronisation", fr: "Synchronisation automatique", es: "Sincronización automática", hr: "Automatska sinkronizacija" },
  "tasks.syncEvery": { en: "Sync every", ru: "Синхр. каждые", de: "Sync alle", fr: "Synchroniser toutes les", es: "Sincronizar cada", hr: "Sinkroniziraj svakih" },
  "tasks.lastSync": { en: "Last sync:", ru: "Последняя синхр.:", de: "Letzter Sync:", fr: "Dernière synchro :", es: "Última sincronización:", hr: "Zadnja sinkronizacija:" },
  "tasks.never": { en: "Never", ru: "Никогда", de: "Nie", fr: "Jamais", es: "Nunca", hr: "Nikad" },
  "tasks.errors": { en: "errors", ru: "ошибок", de: "Fehler", fr: "erreurs", es: "errores", hr: "grešaka" },
  "tasks.syncLog": { en: "Sync Log", ru: "Лог синхронизации", de: "Sync-Log", fr: "Journal de synchronisation", es: "Registro de sincronización", hr: "Zapis sinkronizacije" },
  "tasks.noLogs": { en: "No sync logs yet. Run a sync to see activity here.", ru: "Логов пока нет. Запустите синхронизацию.", de: "Noch keine Sync-Logs. Starten Sie einen Sync, um Aktivität zu sehen.", fr: "Aucun journal pour l'instant. Lancez une synchronisation pour voir l'activité ici.", es: "Aún no hay registros. Lance una sincronización para ver la actividad aquí.", hr: "Još nema zapisa. Pokrenite sinkronizaciju da vidite aktivnost." },
  "tasks.time": { en: "Time", ru: "Время", de: "Zeit", fr: "Heure", es: "Hora", hr: "Vrijeme" },
  "tasks.level": { en: "Level", ru: "Уровень", de: "Level", fr: "Niveau", es: "Nivel", hr: "Razina" },
  "tasks.message": { en: "Message", ru: "Сообщение", de: "Meldung", fr: "Message", es: "Mensaje", hr: "Poruka" },

  // Sync settings
  "sync.title": { en: "Calendar Sync", ru: "Синхронизация календарей", de: "Kalendersynchronisation", fr: "Synchronisation des calendriers", es: "Sincronización de calendarios", hr: "Sinkronizacija kalendara" },
  "sync.syncNow": { en: "Sync Now", ru: "Синхронизировать", de: "Jetzt synchronisieren", fr: "Synchroniser maintenant", es: "Sincronizar ahora", hr: "Sinkroniziraj" },
  "sync.syncing": { en: "Syncing...", ru: "Синхронизация...", de: "Synchronisiere...", fr: "Synchronisation...", es: "Sincronizando...", hr: "Sinkronizacija..." },
  "sync.connected": { en: "Connected", ru: "Подключено", de: "Verbunden", fr: "Connecté", es: "Conectado", hr: "Povezano" },
  "sync.icalLabel": { en: "iCal export URL from", ru: "iCal ссылка экспорта из", de: "iCal-Export-URL von", fr: "URL d'export iCal depuis", es: "URL iCal de exportación desde", hr: "iCal izvozni URL s platforme" },
  "sync.pastePlaceholder": { en: "Paste {platform} iCal URL...", ru: "Вставьте iCal URL от {platform}...", de: "iCal-URL von {platform} einfügen...", fr: "Collez l'URL iCal de {platform}...", es: "Pegue la URL iCal de {platform}...", hr: "Zalijepite iCal URL s platforme {platform}..." },
  "sync.importLabel": { en: "Import this URL into", ru: "Импортируйте этот URL в", de: "Diese URL importieren in", fr: "Importer cette URL dans", es: "Importe esta URL en", hr: "Uvezite ovaj URL u" },
  "sync.bufferDays": { en: "Buffer Days (Cleaning Time)", ru: "Буферные дни (время уборки)", de: "Puffertage (Reinigungszeit)", fr: "Jours tampons (temps de ménage)", es: "Días tampón (tiempo de limpieza)", hr: "Dani pauze (vrijeme za čišćenje)" },
  "sync.bufferDesc": { en: "Block extra days before and after each booking for cleaning. These buffer days will appear as blocked in the imported calendar.", ru: "Заблокировать дополнительные дни до и после каждого бронирования для уборки. Эти дни будут отображаться как занятые в импортированном календаре.", de: "Zusätzliche Tage vor und nach jeder Buchung für die Reinigung sperren. Diese Puffertage erscheinen im importierten Kalender als belegt.", fr: "Bloquer des jours supplémentaires avant et après chaque réservation pour le ménage. Ces jours tampons apparaissent comme bloqués dans le calendrier importé.", es: "Bloquee días extra antes y después de cada reserva para la limpieza. Estos días tampón aparecen como ocupados en el calendario importado.", hr: "Blokirajte dodatne dane prije i poslije svake rezervacije za čišćenje. Ti će se dani u uvezenom kalendaru prikazati kao blokirani." },
  "sync.before": { en: "Before:", ru: "До:", de: "Davor:", fr: "Avant :", es: "Antes:", hr: "Prije:" },
  "sync.after": { en: "After:", ru: "После:", de: "Danach:", fr: "Après :", es: "Después:", hr: "Poslije:" },
  "sync.minStay": { en: "Minimum Stay", ru: "Минимальный срок", de: "Mindestaufenthalt", fr: "Séjour minimum", es: "Estancia mínima", hr: "Najkraći boravak" },
  "sync.minStayDesc": { en: "If the gap between two bookings is too small for a new guest (less than buffer + min nights + buffer), the entire gap is blocked as buffer.", ru: "Если промежуток между двумя бронированиями слишком мал для нового гостя (меньше буфер + мин. ночи + буфер), весь промежуток блокируется.", de: "Ist die Lücke zwischen zwei Buchungen zu klein für einen neuen Gast (weniger als Puffer + Mindestnächte + Puffer), wird die gesamte Lücke als Puffer gesperrt.", fr: "Si l'intervalle entre deux réservations est trop court pour un nouveau voyageur (moins que tampon + nuits min. + tampon), tout l'intervalle est bloqué comme tampon.", es: "Si el hueco entre dos reservas es demasiado corto para un nuevo huésped (menos que tampón + noches mín. + tampón), todo el hueco se bloquea como tampón.", hr: "Ako je rupa između dviju rezervacija premala za novog gosta (manje od pauze + min. noćenja + pauze), cijela se rupa blokira kao pauza." },
  "sync.minNights": { en: "Minimum nights", ru: "Минимум ночей", de: "Mindestnächte", fr: "Nuits minimum", es: "Noches mínimas", hr: "Najmanje noćenja" },
  "sync.lastSynced": { en: "Last synced:", ru: "Последняя синхр.:", de: "Zuletzt synchronisiert:", fr: "Dernière synchro :", es: "Última sincronización:", hr: "Zadnja sinkronizacija:" },
  "sync.feedError": { en: "Feed sync failed", ru: "Ошибка синхронизации фида", de: "Feed-Synchronisierung fehlgeschlagen", fr: "Échec de la synchronisation du flux", es: "Fallo en la sincronización del feed", hr: "Sinkronizacija feeda nije uspjela" },
  "sync.consecutiveFailures": { en: "{count} consecutive failures", ru: "{count} подряд неудачных попыток", de: "{count} aufeinanderfolgende Fehler", fr: "{count} échecs consécutifs", es: "{count} fallos consecutivos", hr: "{count} uzastopnih grešaka" },
  "sync.checkInOutTimes": { en: "Check-in / Check-out Times", ru: "Время заезда / выезда", de: "Check-in- / Check-out-Zeiten", fr: "Horaires d'arrivée / de départ", es: "Horas de entrada / salida", hr: "Vrijeme prijave i odjave" },
  "sync.checkInOutDesc": { en: "Used to display booking bars on the calendar with time-accurate start/end and compute hours available for cleaning between back-to-back guests.", ru: "Используется для отображения полос на календаре с учётом времени и расчёта доступных часов для уборки между гостями.", de: "Wird verwendet, um Buchungsbalken im Kalender mit zeitgenauem Start/Ende anzuzeigen und die verfügbaren Reinigungsstunden zwischen aufeinanderfolgenden Gästen zu berechnen.", fr: "Sert à afficher les barres de réservation du calendrier avec un début et une fin précis, et à calculer les heures disponibles pour le ménage entre deux séjours consécutifs.", es: "Se usa para mostrar las barras de reserva del calendario con un inicio y fin precisos al minuto, y para calcular las horas disponibles de limpieza entre huéspedes consecutivos.", hr: "Koristi se za točan prikaz početka i kraja rezervacija u kalendaru i za izračun sati na raspolaganju za čišćenje između uzastopnih gostiju." },
  "sync.checkInTime": { en: "Check-in", ru: "Заезд", de: "Check-in", fr: "Arrivée", es: "Entrada", hr: "Prijava" },
  "sync.checkOutTime": { en: "Check-out", ru: "Выезд", de: "Check-out", fr: "Départ", es: "Salida", hr: "Odjava" },
  "sync.bookingWindow": { en: "Booking Window", ru: "Окно бронирования", de: "Buchungsfenster", fr: "Fenêtre de réservation", es: "Ventana de reservas", hr: "Prozor rezervacija" },
  "sync.bookingWindowDesc": { en: "How many days forward from today to accept bookings. Events beyond this window are ignored — platforms often block far-future dates that aren't real bookings.", ru: "На сколько дней вперёд от сегодня принимать бронирования. События за пределами окна игнорируются — платформы часто блокируют далёкие даты, которые не являются реальными бронированиями.", de: "Wie viele Tage in die Zukunft Buchungen akzeptiert werden. Events jenseits dieses Fensters werden ignoriert — Plattformen sperren oft weit entfernte Daten, die keine echten Buchungen sind.", fr: "Nombre de jours à l'avance à partir d'aujourd'hui pour accepter les réservations. Les événements hors de cette fenêtre sont ignorés — les plateformes bloquent souvent des dates lointaines qui ne sont pas de vraies réservations.", es: "Cuántos días por delante de hoy se aceptan reservas. Los eventos fuera de esta ventana se ignoran — las plataformas suelen bloquear fechas muy lejanas que no son reservas reales.", hr: "Koliko dana unaprijed od danas prihvaćati rezervacije. Događaji izvan tog prozora se zanemaruju — platforme često blokiraju daleke datume koji nisu prave rezervacije." },
  "sync.bookingWindowDays": { en: "days forward", ru: "дней вперёд", de: "Tage im Voraus", fr: "jours à l'avance", es: "días por delante", hr: "dana unaprijed" },

  // Managers
  "managers.title": { en: "Managers", ru: "Менеджеры", de: "Manager", fr: "Gestionnaires", es: "Gestores", hr: "Upravitelji" },
  "managers.desc": { en: "Grant another user full management access to this property. Managers can edit reservations, sync calendars, and manage cleaning — but cannot delete the property or add other managers.", ru: "Предоставьте другому пользователю полный доступ к управлению этим объектом. Менеджеры могут редактировать брони, синхронизировать календари и управлять уборкой — но не могут удалить объект или добавить других менеджеров.", de: "Erteilen Sie einem anderen Benutzer vollen Verwaltungszugriff auf diese Unterkunft. Manager können Reservierungen bearbeiten, Kalender synchronisieren und Reinigungen verwalten — aber die Unterkunft nicht löschen oder weitere Manager hinzufügen.", fr: "Accordez à un autre utilisateur un accès complet à la gestion de ce logement. Les gestionnaires peuvent modifier les réservations, synchroniser les calendriers et gérer le ménage — mais ne peuvent ni supprimer le logement ni ajouter d'autres gestionnaires.", es: "Conceda a otro usuario acceso completo de gestión a este alojamiento. Los gestores pueden editar reservas, sincronizar calendarios y gestionar la limpieza — pero no pueden eliminar el alojamiento ni añadir otros gestores.", hr: "Dajte drugom korisniku potpun pristup upravljanju ovom nekretninom. Upravitelji mogu uređivati rezervacije, sinkronizirati kalendare i voditi čišćenje — ali ne mogu obrisati nekretninu ni dodavati druge upravitelje." },
  "managers.empty": { en: "No managers yet. Only you can manage this property.", ru: "Пока нет менеджеров. Только вы управляете этим объектом.", de: "Noch keine Manager. Nur Sie verwalten diese Unterkunft.", fr: "Aucun gestionnaire pour l'instant. Seul vous gérez ce logement.", es: "Aún no hay gestores. Solo usted gestiona este alojamiento.", hr: "Još nema upravitelja. Samo vi upravljate ovom nekretninom." },
  "managers.you": { en: "you", ru: "вы", de: "Sie", fr: "vous", es: "usted", hr: "vi" },
  "managers.owner": { en: "owner", ru: "владелец", de: "Eigentümer", fr: "propriétaire", es: "propietario", hr: "vlasnik" },
  "managers.confirmRemove": { en: "Remove this manager? They will lose access to the property.", ru: "Удалить менеджера? Он потеряет доступ к объекту.", de: "Diesen Manager entfernen? Er verliert den Zugriff auf die Unterkunft.", fr: "Retirer ce gestionnaire ? Il perdra l'accès au logement.", es: "¿Quitar a este gestor? Perderá el acceso al alojamiento.", hr: "Ukloniti ovog upravitelja? Izgubit će pristup nekretnini." },
  "managers.ownerOnly": { en: "Only the property owner can manage managers.", ru: "Только владелец объекта может управлять менеджерами.", de: "Nur der Eigentümer der Unterkunft kann Manager verwalten.", fr: "Seul le propriétaire du logement peut gérer les gestionnaires.", es: "Solo el propietario del alojamiento puede gestionar a los gestores.", hr: "Samo vlasnik nekretnine može upravljati upraviteljima." },
  "managers.generateInvite": { en: "Generate invite link", ru: "Создать ссылку-приглашение", de: "Einladungslink erstellen", fr: "Générer un lien d'invitation", es: "Generar enlace de invitación", hr: "Stvori link za pozivnicu" },
  "managers.generating": { en: "Generating…", ru: "Создаём…", de: "Wird erstellt…", fr: "Génération…", es: "Generando…", hr: "Stvaranje…" },
  "managers.inviteCreated": { en: "Invite link ready — copy and send it to the person you want to invite. They'll log in (or sign up) and accept the invite to gain access.", ru: "Ссылка готова — скопируйте и отправьте её. Получатель войдёт (или зарегистрируется) и примет приглашение, чтобы получить доступ.", de: "Einladungslink bereit — kopieren und an die einzuladende Person senden. Sie meldet sich an (oder registriert sich) und nimmt die Einladung an, um Zugriff zu erhalten.", fr: "Lien d'invitation prêt — copiez-le et envoyez-le à la personne à inviter. Elle se connectera (ou s'inscrira) et acceptera l'invitation pour obtenir l'accès.", es: "Enlace de invitación listo — cópielo y envíelo a la persona que desee invitar. Iniciará sesión (o se registrará) y aceptará la invitación para obtener acceso.", hr: "Link za pozivnicu je spreman — kopirajte ga i pošaljite osobi koju pozivate. Ona se prijavi (ili registrira) i prihvati pozivnicu za pristup." },
  "managers.copyLink": { en: "Copy link", ru: "Копировать ссылку", de: "Link kopieren", fr: "Copier le lien", es: "Copiar enlace", hr: "Kopiraj link" },
  "managers.linkCopied": { en: "Copied", ru: "Скопировано", de: "Kopiert", fr: "Copié", es: "Copiado", hr: "Kopirano" },
  "managers.expiresIn": { en: "Expires in {n} days", ru: "Истекает через {n} дн.", de: "Läuft in {n} Tagen ab", fr: "Expire dans {n} jours", es: "Caduca en {n} días", hr: "Istječe za {n} dana" },
  "managers.pendingInvites": { en: "Pending invites", ru: "Ожидающие приглашения", de: "Offene Einladungen", fr: "Invitations en attente", es: "Invitaciones pendientes", hr: "Pozivnice na čekanju" },
  "managers.revokeInvite": { en: "Revoke", ru: "Отменить", de: "Widerrufen", fr: "Révoquer", es: "Revocar", hr: "Opozovi" },
  "managers.confirmRevoke": { en: "Revoke this invite? The link will stop working.", ru: "Отменить приглашение? Ссылка перестанет работать.", de: "Diese Einladung widerrufen? Der Link funktioniert dann nicht mehr.", fr: "Révoquer cette invitation ? Le lien cessera de fonctionner.", es: "¿Revocar esta invitación? El enlace dejará de funcionar.", hr: "Opozvati ovu pozivnicu? Link će prestati raditi." },

  // Date slider
  "dateslider.in": { en: "In", ru: "Заезд", de: "Anreise", fr: "Arrivée", es: "Entrada", hr: "Prijava" },
  "dateslider.out": { en: "Out", ru: "Выезд", de: "Abreise", fr: "Départ", es: "Salida", hr: "Odjava" },
  "dateslider.selectDates": { en: "Select dates", ru: "Выбрать даты", de: "Daten auswählen", fr: "Choisir les dates", es: "Seleccionar fechas", hr: "Odaberite datume" },

  // Guest cards
  "guest.identity": { en: "Identity", ru: "Личность", de: "Identität", fr: "Identité", es: "Identidad", hr: "Identitet" },
  "guest.citizenship": { en: "Citizenship", ru: "Гражданство", de: "Staatsangehörigkeit", fr: "Nationalité", es: "Nacionalidad", hr: "Državljanstvo" },
  "guest.dateOfBirth": { en: "Date of birth", ru: "Дата рождения", de: "Geburtsdatum", fr: "Date de naissance", es: "Fecha de nacimiento", hr: "Datum rođenja" },
  "guest.passport": { en: "Passport", ru: "Паспорт", de: "Reisepass", fr: "Passeport", es: "Pasaporte", hr: "Putovnica" },
  "guest.document": { en: "Document", ru: "Документ", de: "Dokument", fr: "Document", es: "Documento", hr: "Dokument" },
  "guest.dateOfIssue": { en: "Date of issue", ru: "Дата выдачи", de: "Ausstellungsdatum", fr: "Date de délivrance", es: "Fecha de expedición", hr: "Datum izdavanja" },
  "guest.issuedBy": { en: "Issued by", ru: "Кем выдан", de: "Ausgestellt von", fr: "Délivré par", es: "Expedido por", hr: "Izdao" },
  "guest.fullName": { en: "Full name", ru: "Полное имя", de: "Vollständiger Name", fr: "Nom complet", es: "Nombre completo", hr: "Ime i prezime" },
  "guest.gender": { en: "Gender", ru: "Пол", de: "Geschlecht", fr: "Sexe", es: "Sexo", hr: "Spol" },
  "guest.male": { en: "Male", ru: "Мужской", de: "Männlich", fr: "Masculin", es: "Masculino", hr: "Muško" },
  "guest.female": { en: "Female", ru: "Женский", de: "Weiblich", fr: "Féminin", es: "Femenino", hr: "Žensko" },
  "guest.visa": { en: "Visa & Visit", ru: "Виза и визит", de: "Visum & Aufenthalt", fr: "Visa et séjour", es: "Visado y estancia", hr: "Viza i posjet" },
  "guest.visit": { en: "Visit", ru: "Визит", de: "Aufenthalt", fr: "Séjour", es: "Estancia", hr: "Posjet" },
  "guest.visaNumber": { en: "Visa number", ru: "Номер визы", de: "Visumnummer", fr: "Numéro de visa", es: "Número de visado", hr: "Broj vize" },
  "guest.visaFrom": { en: "Visa from", ru: "Виза с", de: "Visum gültig ab", fr: "Visa valide à partir du", es: "Visado válido desde", hr: "Viza od" },
  "guest.visaTo": { en: "Visa to", ru: "Виза до", de: "Visum gültig bis", fr: "Visa valide jusqu'au", es: "Visado válido hasta", hr: "Viza do" },
  "guest.visitType": { en: "Visit type", ru: "Тип визита", de: "Aufenthaltsart", fr: "Type de séjour", es: "Tipo de estancia", hr: "Vrsta posjeta" },
  "guest.tourist": { en: "Tourist", ru: "Турист", de: "Tourist", fr: "Touriste", es: "Turista", hr: "Turist" },
  "guest.guestType": { en: "Guest type", ru: "Тип гостя", de: "Gasttyp", fr: "Type de voyageur", es: "Tipo de huésped", hr: "Vrsta gosta" },
  "guest.other": { en: "Other", ru: "Другое", de: "Sonstige", fr: "Autre", es: "Otro", hr: "Ostalo" },
  "guest.children": { en: "Children", ru: "Дети", de: "Kinder", fr: "Enfants", es: "Niños", hr: "Djeca" },
  "guest.guestsSection": { en: "Guests", ru: "Гости", de: "Gäste", fr: "Voyageurs", es: "Huéspedes", hr: "Gosti" },
  "guest.noGuests": { en: "No guests — drop passports above to extract", ru: "Нет гостей — перетащите паспорта выше для извлечения", de: "Keine Gäste — Reisepässe oben ablegen, um sie auszulesen", fr: "Aucun voyageur — déposez des passeports ci-dessus pour les extraire", es: "Sin huéspedes — suelte pasaportes arriba para extraerlos", hr: "Nema gostiju — ispustite putovnice iznad za izdvajanje" },
  "guest.clickToCopy": { en: "Click any value to copy", ru: "Нажмите на значение для копирования", de: "Auf einen Wert klicken, um ihn zu kopieren", fr: "Cliquez sur une valeur pour la copier", es: "Haga clic en un valor para copiarlo", hr: "Kliknite bilo koju vrijednost za kopiranje" },
  "guest.arrivedOn": { en: "Arrived on (days)", ru: "Прибыл (дней)", de: "Angereist vor (Tage)", fr: "Arrivé depuis (jours)", es: "Llegó hace (días)", hr: "Dolazak (dana)" },
} as const;

export type TranslationKey = keyof typeof translations;
