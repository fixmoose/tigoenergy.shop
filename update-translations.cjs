const fs = require('fs');
const path = require('path');

const SUPPORTED_LOCALES = [
    'en', 'de', 'fr', 'it', 'sl', 'es',
    'nl', 'pl', 'cs', 'sk', 'sv', 'da',
    'ro', 'sr', 'sr-Cyrl', 'mk', 'hr',
    'bg', 'no', 'hu', 'pt', 'lv', 'lt', 'et'
];

const staticPagesEn = {
    "returns": {
        "title": "Returns & Warranty",
        "h14DayReturns": "14-Day Returns",
        "p14DayReturns": "We offer 14-day hassle-free returns for B2C customers for unused items in original packaging.",
        "hWarranty": "Warranty",
        "pWarranty": "Tigo Energy products come with industry-leading manufacturer warranties (up to 25 years for MLPE components)."
    },
    "shipping": {
        "title": "Shipping Information",
        "pLead": "We deliver Tigo Energy solutions across the European Union during business days.",
        "hDeliveryTimes": "Delivery Times",
        "pDeliveryTimes": "Average delivery time is 2-4 business days depending on your location.",
        "hCarriers": "Carriers",
        "pCarriers": "We primarily use GLS and DPD for standard shipments, and specialized freight for larger orders."
    },
    "privacy": {
        "title": "Privacy Policy",
        "lastUpdated": "Last updated: February 7, 2026",
        "intro": "Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your personal data when you use Tigo Energy SHOP.",
        "h1": "1. Information We Collect",
        "p1": "We collect information you provide during registration, such as your name, email, phone number, and address.",
        "h2": "2. How We Use Information",
        "p2": "We use your information to process orders, provide support, and improve our services."
    },
    "terms": {
        "title": "Terms of Service",
        "lastUpdated": "Last updated: February 7, 2026",
        "intro": "By accessing and using Tigo Energy SHOP, you agree to be bound by these terms.",
        "h1": "1. Acceptance of Terms",
        "p1": "These terms govern your use of our website and services.",
        "h2": "2. Use of License",
        "p2": "Permission is granted to temporarily download one copy of the materials on Tigo Energy SHOP's website for personal, non-commercial transitory viewing only."
    },
    "impressum": {
        "title": "Impressum",
        "hCompany": "Company Information",
        "companyName": "Initra Energija d.o.o.",
        "vat": "VAT Number: SI62518313",
        "registration": "Registration Number: 9624007000",
        "hContact": "Contact Information",
        "emailLabel": "Email:",
        "clickToReveal": "Click to reveal",
        "hAuthorized": "Authorized Tigo Energy Distributor",
        "pAuthorized1": "Initra Energija d.o.o. is an authorized distributor of Tigo Energy products in Europe. We specialize exclusively in Tigo Energy solutions, ensuring expert knowledge and authentic products.",
        "hResponsible": "Responsible for Content",
        "pResponsible": "Initra Energija d.o.o. is responsible for all content published on this website."
    },
    "cookies": {
        "title": "Cookie Policy",
        "lastUpdated": "Last updated: February 7, 2026",
        "intro": "This Cookie Policy explains how Tigo Energy SHOP uses cookies and similar technologies to recognize you when you visit our website.",
        "h1": "1. What are cookies?",
        "p1": "Cookies are small data files that are placed on your computer or mobile device when you visit a website.",
        "h2": "2. How we use cookies",
        "p2": "We use essential cookies for the website to function and optional cookies for analytics."
    },
    "faq": {
        "title": "Frequently Asked Questions",
        "q1": "How fast is shipping?",
        "a1": "Standard shipping takes 2-4 business days.",
        "q2": "Do you offer technical support?",
        "a2": "Yes, our experts are available to help you with Tigo product selection and configuration."
    },
    "contact": {
        "title": "Contact Sales",
        "intro": "Looking for volume pricing or have questions about your solar installation? Verify your email below to start a conversation with our sales team.",
        "prefillTitle": "Contact Tigo Sales"
    },
    "productSupport": {
        "title": "Tigo Product Support",
        "intro": "Get technical help with your Tigo Energy products via Shop Messenger"
    },
    "shopSupport": {
        "title": "Online Shop Support",
        "intro": "Get help with orders, shipping, and account issues via Shop Messenger"
    }
};

const staticPagesSl = {
    "returns": {
        "title": "Vračila in garancija",
        "h14DayReturns": "14-dnevno vračilo",
        "p14DayReturns": "Za B2C stranke ponujamo 14-dnevno vračilo brez težav za nerabljene artikle v originalni embalaži.",
        "hWarranty": "Garancija",
        "pWarranty": "Izdelki Tigo Energy imajo vodilne garancije proizvajalca v panogi (do 25 let za komponente MLPE)."
    },
    "shipping": {
        "title": "Informacije o pošiljanju",
        "pLead": "Rešitve Tigo Energy dostavljamo po celotni Evropski uniji med delovnimi dnevi.",
        "hDeliveryTimes": "Časi dostave",
        "pDeliveryTimes": "Povprečni čas dostave je 2-4 delovne dni, odvisno od vaše lokacije.",
        "hCarriers": "Prevozniki",
        "pCarriers": "Za standardne pošiljke prvenstveno uporabljamo GLS in DPD, za večja naročila pa specializirane tovorne prevoze."
    },
    "privacy": {
        "title": "Politika zasebnosti",
        "lastUpdated": "Zadnja posodobitev: 7. februar 2026",
        "intro": "Vaša zasebnost nam je pomembna. Ta politika zasebnosti pojasnjuje, kako zbiramo, uporabljamo in varujemo vaše osebne podatke, ko uporabljate Tigo Energy SHOP.",
        "h1": "1. Podatki, ki jih zbiramo",
        "p1": "Zbiramo podatke, ki jih navedete ob registraciji, kot so vaše ime, e-pošta, telefonska številka in naslov.",
        "h2": "2. Kako uporabljamo podatke",
        "p2": "Vaše podatke uporabljamo za obdelavo naročil, zagotavljanje podpore in izboljšanje naših storitev."
    },
    "terms": {
        "title": "Splošni pogoji",
        "lastUpdated": "Zadnja posodobitev: 7. februar 2026",
        "intro": "Z dostopom in uporabo Tigo Energy SHOP se strinjate s temi pogoji.",
        "h1": "1. Sprejetje pogojev",
        "p1": "Ti pogoji urejajo vašo uporabo naše spletne strani in storitev.",
        "h2": "2. Licenca za uporabo",
        "p2": "Dovoljen je začasen prenos ene kopije gradiv na spletni strani Tigo Energy SHOP samo za osebno, nekomercialno prehodno ogledovanje."
    },
    "impressum": {
        "title": "Impressum",
        "hCompany": "Podatki o podjetju",
        "companyName": "Initra Energija d.o.o.",
        "vat": "ID za DDV: SI62518313",
        "registration": "Matična številka: 9624007000",
        "hContact": "Kontaktni podatki",
        "emailLabel": "E-pošta:",
        "clickToReveal": "Kliknite za prikaz",
        "hAuthorized": "Pooblaščeni Tigo Energy distributer",
        "pAuthorized1": "Initra Energija d.o.o. je pooblaščeni distributer izdelkov Tigo Energy v Evropi. Specializirani smo izključno za rešitve Tigo Energy, kar zagotavlja strokovno znanje in avtentične izdelke.",
        "hResponsible": "Odgovoren za vsebino",
        "pResponsible": "Initra Energija d.o.o. je odgovorna za vso vsebino, objavljeno na tej spletni strani."
    },
    "cookies": {
        "title": "Politika piškotkov",
        "lastUpdated": "Zadnja posodobitev: 7. februar 2026",
        "intro": "Ta politika piškotkov pojasnjuje, kako Tigo Energy SHOP uporablja piškotke in podobne tehnologije za vašo prepoznavo, ko obiščete našo spletno stran.",
        "h1": "1. Kaj so piškotki?",
        "p1": "Piškotki so majhne podatkovne datoteke, ki se shranijo na vaš računalnik ali mobilno napravo, ko obiščete spletno stran.",
        "h2": "2. Kako uporabljamo piškotke",
        "p2": "Uporabljamo nujne piškotke za delovanje spletne strani in neobvezne piškotke za analitiko."
    },
    "faq": {
        "title": "Pogosta vprašanja",
        "q1": "Kako hitra je dostava?",
        "a1": "Standardna dostava traja 2-4 delovne dni.",
        "q2": "Ali nudite tehnično podporo?",
        "a2": "Da, naši strokovnjaki so vam na voljo za pomoč pri izbiri in konfiguraciji izdelkov Tigo."
    },
    "contact": {
        "title": "Kontakt prodaja",
        "intro": "Iščete količinske cene ali imate vprašanja o vaši sončni namestitvi? Spodaj potrdite svojo e-pošto, da začnete pogovor z našo prodajno ekipo.",
        "prefillTitle": "Kontaktirajte Tigo prodajo"
    },
    "productSupport": {
        "title": "Tigo podpora izdelkom",
        "intro": "Prejmite tehnično pomoč za vaše Tigo Energy izdelke prek Shop Messengerja"
    },
    "shopSupport": {
        "title": "Podpora spletne trgovine",
        "intro": "Prejmite pomoč pri naročilih, dostavi in težavah z računom prek Shop Messengerja"
    }
};

const staticPagesHr = {
    "returns": {
        "title": "Povrati i jamstvo",
        "h14DayReturns": "14-dnevni povrat",
        "p14DayReturns": "Za B2C kupce nudimo 14-dnevni povrat bez gnjavaže za nekorištene artikle u originalnom pakiranju.",
        "hWarranty": "Jamstvo",
        "pWarranty": "Tigo Energy proizvodi dolaze s vodećim jamstvima proizvođača u industriji (do 25 godina za MLPE komponente)."
    },
    "shipping": {
        "title": "Informacije o dostavi",
        "pLead": "Tigo Energy rješenja dostavljamo diljem Europske unije tijekom radnih dana.",
        "hDeliveryTimes": "Vrijeme dostave",
        "pDeliveryTimes": "Prosječno vrijeme dostave je 2-4 radna dana, ovisno o vašoj lokaciji.",
        "hCarriers": "Prijevoznici",
        "pCarriers": "Za standardne pošiljke prvenstveno koristimo GLS i DPD, a za veće narudžbe specijalizirani teretni prijevoz."
    },
    "privacy": {
        "title": "Politika privatnosti",
        "lastUpdated": "Zadnje ažuriranje: 7. veljače 2026.",
        "intro": "Vaša privatnost nam je važna. Ova politika privatnosti objašnjava kako prikupljamo, koristimo i štitimo vaše osobne podatke kada koristite Tigo Energy SHOP.",
        "h1": "1. Informacije koje prikupljamo",
        "p1": "Prikupljamo informacije koje nam date tijekom registracije, kao što su vaše ime, e-pošta, telefonski broj i adresa.",
        "h2": "2. Kako koristimo informacije",
        "p2": "Vaše informacije koristimo za obradu narudžbi, pružanje podrške i poboljšanje naših usluga."
    },
    "terms": {
        "title": "Uvjeti korištenja",
        "lastUpdated": "Zadnje ažuriranje: 7. veljače 2026.",
        "intro": "Pristupanjem i korištenjem Tigo Energy SHOP-a, slažete se s ovim uvjetima.",
        "h1": "1. Prihvaćanje uvjeta",
        "p1": "Ovi uvjeti uređuju vašu upotrebu naše web stranice i usluga.",
        "h2": "2. Licenca za korištenje",
        "p2": "Dopušteno je privremeno preuzimanje jedne kopije materijala na web stranici Tigo Energy SHOP-a samo za osobno, nekomercijalno privremeno pregledavanje."
    },
    "impressum": {
        "title": "Impressum",
        "hCompany": "Podaci o tvrtki",
        "companyName": "Initra Energija d.o.o.",
        "vat": "PDV broj: SI62518313",
        "registration": "Matični broj: 9624007000",
        "hContact": "Kontakt informacije",
        "emailLabel": "E-pošta:",
        "clickToReveal": "Kliknite za prikaz",
        "hAuthorized": "Ovlašteni Tigo Energy distributer",
        "pAuthorized1": "Initra Energija d.o.o. je ovlašteni distributer proizvoda Tigo Energy u Europi. Specijalizirani smo isključivo za rješenja Tigo Energy, što osigurava stručno znanje i autentične proizvode.",
        "hResponsible": "Odgovoran za sadržaj",
        "pResponsible": "Initra Energija d.o.o. je odgovorna za sav sadržaj objavljen na ovoj web stranici."
    },
    "cookies": {
        "title": "Politika kolačića",
        "lastUpdated": "Zadnje ažuriranje: 7. veljače 2026.",
        "intro": "Ova politika kolačića objašnjava kako Tigo Energy SHOP koristi kolačiće i slične tehnologije za vaše prepoznavanje kada posjetite našu web stranicu.",
        "h1": "1. Što su kolačići?",
        "p1": "Kolačići su male podatkovne datoteke koje se pohranjuju na vašem računalu ili mobilnom uređaju kada posjetite web stranicu.",
        "h2": "2. Kako koristimo kolačiće",
        "p2": "Koristimo neophodne kolačiće za funkcioniranje web stranice i opcionalne kolačiće za analitiku."
    },
    "faq": {
        "title": "Često postavljana pitanja",
        "q1": "Koliko je brza dostava?",
        "a1": "Standardna dostava traje 2-4 radna dana.",
        "q2": "Nudite li tehničku podršku?",
        "a2": "Da, naši stručnjaci su vam na raspolaganju za pomoć pri odabiru i konfiguraciji Tigo proizvoda."
    },
    "contact": {
        "title": "Kontakt prodaja",
        "intro": "Tražite cijene za veće količine ili imate pitanja o svojoj solarnoj instalaciji? Potvrdite svoju e-poštu u nastavku kako biste započeli razgovor s našim prodajnim timom.",
        "prefillTitle": "Kontaktirajte Tigo Sales"
    },
    "productSupport": {
        "title": "Tigo podrška proizvodima",
        "intro": "Dobijte tehničku pomoć uz svoje Tigo Energy proizvode putem Shop Messengera"
    },
    "shopSupport": {
        "title": "Podrška za online trgovinu",
        "intro": "Dobijte pomoć oko narudžbi, dostavi i računa putem Shop Messengera"
    }
};

function updateJson(filePath, data) {
    if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        return;
    }
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    content.staticPages = data;
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
    console.log(`Updated ${filePath}`);
}

const basePath = process.argv[2] || '.';
SUPPORTED_LOCALES.forEach(locale => {
    const filePath = path.join(basePath, `src/messages/${locale}.json`);
    let data = staticPagesEn; // Default to English
    if (locale === 'sl') data = staticPagesSl;
    if (locale === 'hr') data = staticPagesHr;

    updateJson(filePath, data);
});
