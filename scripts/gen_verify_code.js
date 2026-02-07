const fs = require('fs');
const path = require('path');

const langs = {
    bg: { title: 'Потвърдете вашия имейл адрес', hello: 'Здравейте,', text: 'Благодарим ви, че се присъединихте към Tigo Energy SHOP. За да завършите регистрацията си и да защитите акаунта си, моля, използвайте следния код за потвърждение:', expire: 'Този код ще изтече след 10 минути.' },
    cs: { title: 'Ověřte svou e-mailovou adresu', hello: 'Dobrý den,', text: 'Děkujeme, že jste se připojili k Tigo Energy SHOP. Pro dokončení registrace a zabezpečení účtu použijte prosím následující ověřovací kód:', expire: 'Tento kód vyprší za 10 minut.' },
    da: { title: 'Bekræft din e-mailadresse', hello: 'Hej,', text: 'Tak fordi du har tilmeldt dig Tigo Energy SHOP. For at færdiggøre din registrering og sikre din konto, skal du bruge følgende bekræftelseskode:', expire: 'Denne kode udløber om 10 minutter.' },
    de: { title: 'E-Mail-Adresse bestätigen', hello: 'Hallo,', text: 'Vielen Dank für Ihre Anmeldung bei Tigo Energy SHOP. Um Ihre Registrierung abzuschließen und Ihr Konto zu sichern, verwenden Sie bitte den folgenden Bestätigungscode:', expire: 'Dieser Code läuft in 10 Minuten ab.' },
    es: { title: 'Verifique su dirección de correo electrónico', hello: 'Hola,', text: 'Gracias por unirse a Tigo Energy SHOP. Para completar su registro y asegurar su cuenta, utilice el siguiente código de verificación:', expire: 'Este código caducará en 10 minutos.' },
    et: { title: 'Kinnitage oma e-posti aadress', hello: 'Tere,', text: 'Täname, et liitusite Tigo Energy SHOP-iga. Registreerimise lõpuleviimiseks ja konto turvamiseks kasutage järgmist kinnituskoodi:', expire: 'See kood aegub 10 minuti jooksul.' },
    fr: { title: 'Vérifiez votre adresse e-mail', hello: 'Bonjour,', text: 'Merci d\'avoir rejoint Tigo Energy SHOP. Pour compléter votre inscription et sécuriser votre compte, veuillez utiliser le code de vérification suivant :', expire: 'Ce code expirera dans 10 minutes.' },
    hr: { title: 'Potvrdite svoju e-mail adresu', hello: 'Zdravo,', text: 'Hvala vam što ste se pridružili Tigo Energy SHOP-u. Da biste dovršili registraciju i osigurali svoj račun, upotrijebite sljedeći potvrdni kôd:', expire: 'Ovaj kôd istječe za 10 minuta.' },
    hu: { title: 'Igazolja e-mail címét', hello: 'Üdvözöljük!', text: 'Köszönjük, hogy csatlakozott a Tigo Energy SHOP-hoz. A regisztráció befejezéséhez és fiókja biztonságossá tételéhez használja az alábbi ellenőrző kódot:', expire: 'Ez a kód 10 perc múlva lejár.' },
    it: { title: 'Verifica il tuo indirizzo e-mail', hello: 'Ciao,', text: 'Grazie per esserti iscritto a Tigo Energy SHOP. Per completare la registrazione e proteggere il tuo account, utilizza il seguente codice di verifica:', expire: 'Questo codice scadrà tra 10 minuti.' },
    lt: { title: 'Patvirtinkite savo el. pašto adresą', hello: 'Sveiki,', text: 'Dėkojame, kad prisijungėte prie Tigo Energy SHOP. Norėdami pabaigti registraciją ir apsaugoti savo paskyrą, naudokite šį patvirtinimo kodą:', expire: 'Šis kodas nustos galioti po 10 minučių.' },
    lv: { title: 'Apstipriniet savu e-pasta adresi', hello: 'Labdien!', text: 'Paldies, ka pievienojāties Tigo Energy SHOP. Lai pabeigtu reģistrāciju un nodrošinātu savu kontu, lūdzu, izmantojiet šādu apstiprinājuma kodu:', expire: 'Šis kods beigsies pēc 10 minūtēm.' },
    mk: { title: 'Потврдете ја вашата е-пошта', hello: 'Здраво,', text: 'Ви благодариме што се придруживте на Tigo Energy SHOP. За да ја завршите вашата регистрација и да го обезбедите вашиот профил, ве молиме користете го следниот код за потвърда:', expire: 'Овој код ќе истече за 10 минути.' },
    nl: { title: 'Verifieer uw e-mailadres', hello: 'Hallo,', text: 'Bedankt voor uw aanmelding bij Tigo Energy SHOP. Gebruik de volgende verificatiecode om uw registratie te voltooien en uw account te beveiligen:', expire: 'Deze code verloopt over 10 minuten.' },
    no: { title: 'Bekreft e-postadressen din', hello: 'Hei,', text: 'Takk for at du har registrert deg hos Tigo Energy SHOP. For å fullføre registreringen og sikre kontoen din, vennligst bruk følgende bekræftelseskode:', expire: 'Denne koden utløper om 10 minutter.' },
    pl: { title: 'Zweryfikuj swój adres e-mail', hello: 'Witaj,', text: 'Dziękujemy za dołączenie do Tigo Energy SHOP. Aby ukończyć rejestrację i zabezpieczyć swoje konto, użyj następującego kodu weryfikacyjnego:', expire: 'Ten kod wygaśnie za 10 minut.' },
    pt: { title: 'Verifique o seu endereço de e-mail', hello: 'Olá,', text: 'Obrigado por se juntar à Tigo Energy SHOP. Para concluir o seu registo e proteger a sua conta, utilize o seguinte código de verificação:', expire: 'Este código expira em 10 minutos.' },
    ro: { title: 'Verificați adresa de e-mail', hello: 'Bună ziua,', text: 'Vă mulțumim că v-ați alăturat Tigo Energy SHOP. Pentru a finaliza înregistrarea și a vă securiza contul, vă rugăm să utilizați următorul cod de verificare:', expire: 'Acest cod va expira în 10 minute.' },
    sk: { title: 'Overte svoju e-mailovú adresu', hello: 'Dobrý deň,', text: 'Ďakujeme, že ste sa pripojili k Tigo Energy SHOP. Na dokončenie registrácie a zabezpečenie účtu použite nasledujúci overovací kód:', expire: 'Tento kód vyprší o 10 minút.' },
    sl: { title: 'Potrdite svoj e-poštni naslov', hello: 'Pozdravljeni,', text: 'Hvala, ker ste se pridružili Tigo Energy SHOP. Za dokončanje registracije in zavarovanje računa uporabite naslednjo potrditveno kodo:', expire: 'Ta koda poteče čez 10 minut.' },
    'sr-Cyrl': { title: 'Потврдите своју е-адресу', hello: 'Здраво,', text: 'Хвала вам што сте се придружили Tigo Energy SHOP-у. Да бисте довршили регистрацију и осигурали свој налог, користите следећи код за потврду:', expire: 'Овај код истиче за 10 минута.' },
    sr: { title: 'Potrdite svoju e-adresu', hello: 'Zdravo,', text: 'Hvala vam što ste se pridružili Tigo Energy SHOP-u. Da biste dovršili registraciju i osigurali svoj nalog, koristite sledeći kod za potvrdu:', expire: 'Ovaj kod ističe za 10 minuta.' },
    sv: { title: 'Verifiera din e-postadress', hello: 'Hej,', text: 'Tack för att du har gått med i Tigo Energy SHOP. För att slutföra din registrering och säkra ditt konto, vänligen använd följande verifieringskod:', expire: 'Denna kod upphör att gälla om 10 minuter.' }
};

const baseHtml = `<!DOCTYPE html>
<html lang="{{lang}}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <style>
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9fafb; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { background: #1a1a1a; padding: 40px 20px; text-align: center; }
        .logo { max-width: 180px; height: auto; }
        .content { padding: 40px 30px; }
        .title { font-size: 24px; font-weight: 700; color: #111; margin-bottom: 20px; }
        .code-container { background: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin: 30px 0; border: 1px dashed #d1d5db; }
        .code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #3ba140; margin: 0; }
        .footer { background: #f3f4f6; padding: 30px; text-align: center; font-size: 12px; color: #6b7280; }
        .footer p { margin: 4px 0; }
        .footer a { color: #3ba140; text-decoration: none; }
        .divider { border-top: 1px solid #e5e7eb; margin: 24px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="https://tigoenergy.shop/tigo-logo-white.png" alt="Tigo Energy" class="logo">
        </div>
        <div class="content">
            <h1 class="title">{{title}}</h1>
            <p>{{hello}}</p>
            <p>{{text}}</p>
            
            <div class="code-container">
                <p class="code">{{code}}</p>
            </div>
            
            <p>{{expire}} {{ignore}}</p>
            
            <div class="divider"></div>
            
            <p>{{bestRegards}}<br>{{team}}</p>
        </div>
        <div class="footer">
            <p><strong>Initra Energija d.o.o.</strong></p>
            <p>{{t_footer_operatedBy}}</p>
            <p><a href="mailto:support@tigoenergy.shop">support@tigoenergy.shop</a> | <a href="https://tigoenergy.shop">tigoenergy.shop</a></p>
            <p>&copy; 2026 {{t_footer_allRightsReserved}}</p>
        </div>
    </div>
</body>
</html>`;

const common = {
    bg: { ignore: 'Ако не сте поискали това, моля, игнорирайте този имейл.', bestRegards: 'С уважение,', team: 'Екипът на Tigo Energy SHOP' },
    cs: { ignore: 'Pokud jste o to nepožádali, tento e-mail prosím ignorujte.', bestRegards: 'S pozdravem,', team: 'Tým Tigo Energy SHOP' },
    da: { ignore: 'Hvis du ikke har anmodet om dette, skal du ignorere denne e-mail.', bestRegards: 'Med venlig hilsen,', team: 'Tigo Energy SHOP-teamet' },
    de: { ignore: 'Wenn Sie dies nicht angefordert haben, ignorieren Sie bitte diese E-Mail.', bestRegards: 'Mit freundlichen Grüßen,', team: 'Das Tigo Energy SHOP Team' },
    es: { ignore: 'Si no solicitó esto, ignore este correo electrónico.', bestRegards: 'Atentamente,', team: 'El equipo de Tigo Energy SHOP' },
    et: { ignore: 'Kui te ei ole seda taotlenud, siis palun eirake seda e-kirja.', bestRegards: 'Parimate soovidega,', team: 'Tigo Energy SHOP tiim' },
    fr: { ignore: 'Si vous n\'avez pas demandé cela, veuillez ignorer cet e-mail.', bestRegards: 'Cordialement,', team: 'L\'équipe Tigo Energy SHOP' },
    hr: { ignore: 'Ako ovo niste zatražili, zanemarite ovu e-poruku.', bestRegards: 'Srdačan pozdrav,', team: 'Tim Tigo Energy SHOP' },
    hu: { ignore: 'Ha ezt nem Ön kérte, kérjük, hagyja figyelmen kívül ezt az e-mailt.', bestRegards: 'Üdvözlettel,', team: 'A Tigo Energy SHOP csapata' },
    it: { ignore: 'Se não hai richiesto questo, ignora questa e-mail.', bestRegards: 'Cordiali saluti,', team: 'Il team di Tigo Energy SHOP' },
    lt: { ignore: 'Jei to neprašėte, ignoruokite šį el. laišką.', bestRegards: 'Pagarbiai,', team: 'Tigo Energy SHOP komanda' },
    lv: { ignore: 'Ja jūs to nepieprasījāt, lūdzu, ignorējiet šo e-pasta ziņojumu.', bestRegards: 'Ar cieņu,', team: 'Tigo Energy SHOP komanda' },
    mk: { ignore: 'Ако не сте го побарале ова, ве молиме игнорирајте ја оваа порака.', bestRegards: 'Со почит,', team: 'Тимот на Tigo Energy SHOP' },
    nl: { ignore: 'Als u dit niet heeft aangevraagd, kunt u deze e-mail negeren.', bestRegards: 'Met vriendelijke groet,', team: 'Het Tigo Energy SHOP-team' },
    no: { ignore: 'Hvis du ikke har bedt om dette, vennligst ignorer denne e-posten.', bestRegards: 'Med vennlig hilsen,', team: 'Tigo Energy SHOP-teamet' },
    pl: { ignore: 'Jeśli to nie Ty, zignoruj tę wiadomość.', bestRegards: 'Z poważaniem,', team: 'Zespół Tigo Energy SHOP' },
    pt: { ignore: 'Se não solicitou isto, ignore este e-mail.', bestRegards: 'Atentamente,', team: 'A equipa Tigo Energy SHOP' },
    ro: { ignore: 'Dacă nu ați solicitat acest lucru, vă rugăm să ignorați acest e-mail.', bestRegards: 'Cu stimă,', team: 'Echipa Tigo Energy SHOP' },
    sk: { ignore: 'Ak ste o to nepožiadali, tento e-mail ignorujte.', bestRegards: 'S pozdravom,', team: 'Tím Tigo Energy SHOP' },
    sl: { ignore: 'Če tega niste zahtevali, prezrite to e-pošto.', bestRegards: 'Lep pozdrav,', team: 'Ekipa Tigo Energy SHOP' },
    'sr-Cyrl': { ignore: 'Ако нисте затражили ово, занемарите ову е-поруку.', bestRegards: 'С поштовањем,', team: 'Тим Tigo Energy SHOP' },
    sr: { ignore: 'Ako niste zatražili ovo, zanemarite ovu e-poruku.', bestRegards: 'Srdačan pozdrav,', team: 'Tim Tigo Energy SHOP' },
    sv: { ignore: 'Om du inte har begärt detta, ignorera detta e-postmeddelande.', bestRegards: 'Med vänlig hälsning,', team: 'Tigo Energy SHOP-teamet' }
};

for (const lang in langs) {
    const data = { ...langs[lang], ...common[lang], lang };
    let html = baseHtml;
    for (const key in data) {
        html = html.replace(new RegExp(\`{{\${key}}}\`, 'g'), data[key]);
  }
  const dir = path.join(__dirname, '../src/lib/email/templates', lang);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'verification-code.html'), html);
}
console.log('Verification code templates generated for all languages.');
