const fs = require('fs');
const path = require('path');

const staticPages = {
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
    }
};

function updateJson(filePath, data) {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    content.staticPages = data;
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
    console.log(`Updated ${filePath}`);
}

const basePath = process.argv[2] || '.';
updateJson(path.join(basePath, 'src/messages/sl.json'), staticPages);
updateJson(path.join(basePath, 'src/messages/hr.json'), staticPagesHr);
