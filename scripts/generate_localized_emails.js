const fs = require('fs');
const path = require('path');

const languages = ['bg', 'cs', 'da', 'de', 'es', 'et', 'fr', 'hr', 'hu', 'it', 'lt', 'lv', 'mk', 'nl', 'no', 'pl', 'pt', 'ro', 'sk', 'sl', 'sr-Cyrl', 'sr', 'sv'];

const common = {
    en: {
        distributor: 'Authorized Tigo Energy Distributor',
        rights: 'All rights reserved.',
        bestRegards: 'Best regards,',
        team: 'The Tigo Energy SHOP Team'
    },
    sl: {
        distributor: 'Pooblaščeni distributer Tigo Energy',
        rights: 'Vse pravice pridržane.',
        bestRegards: 'Lep pozdrav,',
        team: 'Ekipa Tigo Energy SHOP'
    },
    de: {
        distributor: 'Autorisierter Tigo Energy Distributor',
        rights: 'Alle Rechte vorbehalten.',
        bestRegards: 'Mit freundlichen Grüßen,',
        team: 'Das Tigo Energy SHOP Team'
    },
    it: {
        distributor: 'Distributore autorizzato Tigo Energy',
        rights: 'Tutti i diritti riservati.',
        bestRegards: 'Cordiali saluti,',
        team: 'Il team di Tigo Energy SHOP'
    },
    fr: {
        distributor: 'Distributeur agréé Tigo Energy',
        rights: 'Tous droits réservés.',
        bestRegards: 'Cordialement,',
        team: 'L\'équipe Tigo Energy SHOP'
    },
    es: {
        distributor: 'Distribuidor autorizado de Tigo Energy',
        rights: 'Todos los derechos reservados.',
        bestRegards: 'Atentamente,',
        team: 'El equipo de Tigo Energy SHOP'
    }
    // ... I will add more in the final script
};

// For now, I'll just use a few languages to verify.
const targetLangs = ['sl', 'de', 'it', 'fr', 'es'];

const templates = [
    'verification-code',
    'verification-link',
    'welcome',
    'message-sent',
    'new-message',
    'order-confirmation',
    'order-partial',
    'cart-abandonment',
    'price-change',
    'delivered',
    'b2b-vies-verified',
    'b2b-application-received',
    'password-reset',
    'shipping-update'
];

async function generate() {
    const baseDir = path.join(__dirname, '../src/lib/email/templates/en');
    const outDir = path.join(__dirname, '../src/lib/email/templates');

    for (const lang of targetLangs) {
        console.log(`Generating templates for ${lang}...`);
        const langPath = path.join(outDir, lang);
        if (!fs.existsSync(langPath)) fs.mkdirSync(langPath, { recursive: true });

        for (const template of templates) {
            const baseFile = path.join(baseDir, `${template}.html`);
            if (!fs.existsSync(baseFile)) continue;

            let html = fs.readFileSync(baseFile, 'utf8');

            // This is where I would apply the translations.
            // For this demonstration, I'll just show the concept.
            // In a real scenario, I'd have a massive translation map.

            // Example replacement (logic only)
            if (common[lang]) {
                html = html.replace('Authorized Tigo Energy Distributor', common[lang].distributor);
                html = html.replace('All rights reserved.', common[lang].rights);
                html = html.replace('Best regards,', common[lang].bestRegards);
                html = html.replace('The Tigo Energy SHOP Team', common[lang].team);
            }

            fs.writeFileSync(path.join(langPath, `${template}.html`), html);
        }
    }
}

generate();
