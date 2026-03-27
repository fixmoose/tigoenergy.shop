import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getMarketFromKey } from '@/lib/constants/markets'
import { buildHreflangAlternates, buildCanonicalUrl } from '@/lib/utils/seo'

interface StaticPageMeta {
    path: string
    titleKey: string
    descriptionKey: string
}

const PAGE_META: Record<string, Record<string, { title: string; description: string }>> = {
    shipping: {
        en: { title: 'Shipping Information', description: 'Shipping options, delivery times, and carriers for Tigo Energy solar products.' },
        sl: { title: 'Informacije o dostavi', description: 'Možnosti dostave, dobavni roki in prevozniki za Tigo Energy solarne izdelke.' },
        de: { title: 'Versandinformationen', description: 'Versandoptionen, Lieferzeiten und Spediteure für Tigo Energy Solarprodukte.' },
        fr: { title: 'Informations de livraison', description: 'Options de livraison, délais et transporteurs pour les produits solaires Tigo Energy.' },
        it: { title: 'Informazioni sulla spedizione', description: 'Opzioni di spedizione, tempi di consegna e corrieri per i prodotti solari Tigo Energy.' },
        es: { title: 'Información de envío', description: 'Opciones de envío, plazos de entrega y transportistas para productos solares Tigo Energy.' },
        hr: { title: 'Informacije o dostavi', description: 'Opcije dostave, rokovi isporuke i prijevoznici za Tigo Energy solarne proizvode.' },
        nl: { title: 'Verzendinformatie', description: 'Verzendopties, levertijden en vervoerders voor Tigo Energy zonnepanelen.' },
        pl: { title: 'Informacje o wysyłce', description: 'Opcje wysyłki, czasy dostawy i przewoźnicy produktów solarnych Tigo Energy.' },
        sv: { title: 'Fraktinformation', description: 'Fraktalternativ, leveranstider och transportörer för Tigo Energy solprodukter.' },
    },
    faq: {
        en: { title: 'Frequently Asked Questions', description: 'Find answers to common questions about Tigo Energy solar products, ordering, and support.' },
        sl: { title: 'Pogosta vprašanja', description: 'Odgovori na pogosta vprašanja o Tigo Energy solarnih izdelkih, naročanju in podpori.' },
        de: { title: 'Häufig gestellte Fragen', description: 'Antworten auf häufige Fragen zu Tigo Energy Solarprodukten, Bestellung und Support.' },
        fr: { title: 'Questions fréquentes', description: 'Réponses aux questions courantes sur les produits solaires Tigo Energy.' },
        it: { title: 'Domande frequenti', description: 'Risposte alle domande più comuni sui prodotti solari Tigo Energy.' },
        es: { title: 'Preguntas frecuentes', description: 'Respuestas a preguntas frecuentes sobre los productos solares Tigo Energy.' },
        hr: { title: 'Često postavljana pitanja', description: 'Odgovori na česta pitanja o Tigo Energy solarnim proizvodima.' },
        nl: { title: 'Veelgestelde vragen', description: 'Antwoorden op veelgestelde vragen over Tigo Energy zonnepanelen.' },
        pl: { title: 'Najczęściej zadawane pytania', description: 'Odpowiedzi na najczęściej zadawane pytania o produktach solarnych Tigo Energy.' },
        sv: { title: 'Vanliga frågor', description: 'Svar på vanliga frågor om Tigo Energy solprodukter.' },
    },
    contact: {
        en: { title: 'Contact Us', description: 'Get in touch with Tigo Energy support. We are here to help with your solar energy questions.' },
        sl: { title: 'Kontaktirajte nas', description: 'Stopite v stik s podporo Tigo Energy. Tukaj smo za vaša vprašanja o solarni energiji.' },
        de: { title: 'Kontakt', description: 'Kontaktieren Sie den Tigo Energy Support. Wir helfen Ihnen bei Fragen zu Solarenergie.' },
        fr: { title: 'Contactez-nous', description: 'Contactez le support Tigo Energy. Nous sommes là pour vous aider.' },
        it: { title: 'Contattaci', description: 'Contatta il supporto Tigo Energy. Siamo qui per aiutarti.' },
        es: { title: 'Contáctenos', description: 'Contacte con el soporte de Tigo Energy. Estamos aquí para ayudarle.' },
        hr: { title: 'Kontaktirajte nas', description: 'Stupite u kontakt s Tigo Energy podrškom.' },
        nl: { title: 'Neem contact op', description: 'Neem contact op met Tigo Energy support.' },
        pl: { title: 'Skontaktuj się z nami', description: 'Skontaktuj się z pomocą techniczną Tigo Energy.' },
        sv: { title: 'Kontakta oss', description: 'Kontakta Tigo Energy support.' },
    },
    returns: {
        en: { title: 'Returns & Refunds', description: 'Return policy and refund information for Tigo Energy products.' },
        sl: { title: 'Vračila in povračila', description: 'Politika vračil in informacije o povračilih za Tigo Energy izdelke.' },
        de: { title: 'Rückgabe & Erstattung', description: 'Rückgaberichtlinien und Erstattungsinformationen für Tigo Energy Produkte.' },
        fr: { title: 'Retours et remboursements', description: 'Politique de retour et informations de remboursement pour les produits Tigo Energy.' },
        it: { title: 'Resi e rimborsi', description: 'Politica di reso e informazioni sui rimborsi per i prodotti Tigo Energy.' },
        es: { title: 'Devoluciones y reembolsos', description: 'Política de devoluciones y reembolsos para productos Tigo Energy.' },
        hr: { title: 'Povrati i povrati novca', description: 'Pravila povrata i informacije o povratu novca za Tigo Energy proizvode.' },
    },
    privacy: {
        en: { title: 'Privacy Policy', description: 'How Tigo Energy collects, uses, and protects your personal data.' },
        sl: { title: 'Politika zasebnosti', description: 'Kako Tigo Energy zbira, uporablja in ščiti vaše osebne podatke.' },
        de: { title: 'Datenschutzerklärung', description: 'Wie Tigo Energy Ihre personenbezogenen Daten erfasst, verwendet und schützt.' },
        fr: { title: 'Politique de confidentialité', description: 'Comment Tigo Energy collecte, utilise et protège vos données personnelles.' },
        it: { title: 'Informativa sulla privacy', description: 'Come Tigo Energy raccoglie, utilizza e protegge i tuoi dati personali.' },
        es: { title: 'Política de privacidad', description: 'Cómo Tigo Energy recopila, utiliza y protege sus datos personales.' },
        hr: { title: 'Politika privatnosti', description: 'Kako Tigo Energy prikuplja, koristi i štiti vaše osobne podatke.' },
    },
    terms: {
        en: { title: 'Terms of Service', description: 'Terms and conditions for using Tigo Energy products and services.' },
        sl: { title: 'Pogoji uporabe', description: 'Pogoji in pravila za uporabo Tigo Energy izdelkov in storitev.' },
        de: { title: 'Allgemeine Geschäftsbedingungen', description: 'Allgemeine Geschäftsbedingungen für Tigo Energy Produkte und Dienstleistungen.' },
        fr: { title: 'Conditions générales', description: "Conditions générales d'utilisation des produits et services Tigo Energy." },
        it: { title: 'Termini di servizio', description: 'Termini e condizioni per i prodotti e servizi Tigo Energy.' },
        es: { title: 'Términos de servicio', description: 'Términos y condiciones para los productos y servicios Tigo Energy.' },
        hr: { title: 'Uvjeti korištenja', description: 'Uvjeti korištenja Tigo Energy proizvoda i usluga.' },
    },
    impressum: {
        en: { title: 'Legal Notice', description: 'Legal information and company details for Tigo Energy.' },
        sl: { title: 'Pravno obvestilo', description: 'Pravne informacije in podatki o podjetju Tigo Energy.' },
        de: { title: 'Impressum', description: 'Rechtliche Informationen und Unternehmensangaben von Tigo Energy.' },
        fr: { title: 'Mentions légales', description: 'Informations légales et détails de la société Tigo Energy.' },
        it: { title: 'Note legali', description: 'Informazioni legali e dettagli aziendali di Tigo Energy.' },
        hr: { title: 'Pravna obavijest', description: 'Pravne informacije i podaci o tvrtki Tigo Energy.' },
    },
    cookies: {
        en: { title: 'Cookie Policy', description: 'How Tigo Energy uses cookies and similar technologies on our website.' },
        sl: { title: 'Politika piškotkov', description: 'Kako Tigo Energy uporablja piškotke in podobne tehnologije na naši spletni strani.' },
        de: { title: 'Cookie-Richtlinie', description: 'Wie Tigo Energy Cookies und ähnliche Technologien auf unserer Website verwendet.' },
        fr: { title: 'Politique de cookies', description: 'Comment Tigo Energy utilise les cookies et technologies similaires.' },
        it: { title: 'Politica sui cookie', description: 'Come Tigo Energy utilizza i cookie e tecnologie simili.' },
        hr: { title: 'Politika kolačića', description: 'Kako Tigo Energy koristi kolačiće i slične tehnologije.' },
    },
}

export async function generateStaticPageMetadata(pageName: string): Promise<Metadata> {
    const headersList = await headers()
    const marketKey = headersList.get('x-market-key') || 'SHOP'
    const market = getMarketFromKey(marketKey)
    const lang = market.defaultLanguage
    const path = `/${pageName}`

    const meta = PAGE_META[pageName]?.[lang] || PAGE_META[pageName]?.en || { title: pageName, description: '' }

    return {
        title: `${meta.title} | Initra Energija ${market.countryName}`,
        description: meta.description,
        alternates: {
            canonical: buildCanonicalUrl(marketKey, path),
            languages: buildHreflangAlternates(path),
        },
        openGraph: {
            title: `${meta.title} | Initra Energija ${market.countryName}`,
            description: meta.description,
            locale: market.locale,
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title: `${meta.title} | Initra Energija ${market.countryName}`,
            description: meta.description,
        },
    }
}
