/**
 * Order confirmation email — plain HTML generator.
 * Localized labels are loaded from the message files at send-time.
 */

interface OrderEmailData {
    orderNumber: string
    customerName: string
    email: string
    items: {
        sku: string;
        name: string;
        quantity: number;
        unitPrice: number;
        originalUnitPrice?: number;
        totalPrice: number
    }[]
    subtotal: number
    shippingCost: number
    vatAmount: number
    total: number
    currency: string
    shippingAddress: {
        first_name?: string
        last_name?: string
        street?: string
        street2?: string
        city?: string
        postal_code?: string
        country?: string
    }
    paymentMethod: string
    language: string
    isExport?: boolean
    isLowStock?: boolean
    pickupPaymentProofRequired?: boolean
}

// Inline labels per language (subset — keeps the email self-contained)
const LABELS: Record<string, Record<string, string>> = {
    en: {
        subject: 'Order Confirmation — #{orderNumber}',
        greeting: 'Hi {name},',
        thanks: 'Thank you for your order! Here is your order summary:',
        orderNumber: 'Order Number',
        sku: 'SKU',
        product: 'Product',
        qty: 'Qty',
        price: 'Price',
        total: 'Total',
        subtotal: 'Subtotal (Net)',
        shipping: 'Shipping',
        vat: 'VAT',
        grandTotal: 'Grand Total',
        shippingTo: 'Shipping To',
        payment: 'Payment Method',
        footer: 'If you have any questions, contact us at support@tigoenergy.shop',
        thankYou: 'Thank you for choosing Tigo Energy!',
        customsTitle: 'Important: Customs & Import Duties',
        customsBody: 'This order is shipping outside the European Union. Customs duties, import taxes, and other fees are NOT included in the order total and are the sole responsibility of the buyer. Please contact your local customs authority to determine any additional charges before your shipment arrives. If delivery fails due to unpaid customs duties and goods are returned to us, a restocking fee will apply.',
        paymentInstructions: 'Payment Instructions',
        bankRegular: 'Regular speed',
        bankFaster: 'Faster',
        paymentReference: 'Payment Reference',
        payNowWise: 'Pay Now with Wise',
        lowStockTitle: 'Stock Verification Required',
        lowStockBody: 'Some items in your order have limited availability. Our team will verify stock and send you a confirmation email within 24 hours. If any items are unavailable, we will contact you to discuss alternatives.',
        paymentProofTitle: 'Payment Required Before Pickup',
        paymentProofBody: 'This is a personal pickup order. You must present proof of payment (bank transfer confirmation) to our warehouse staff before items will be released. Items will NOT be handed over without verified proof of payment.',
    },
    de: {
        subject: 'Bestellbestätigung — #{orderNumber}',
        greeting: 'Hallo {name},',
        thanks: 'Vielen Dank für Ihre Bestellung! Hier ist Ihre Bestellübersicht:',
        orderNumber: 'Bestellnummer',
        sku: 'Art.-Nr.',
        product: 'Produkt',
        qty: 'Menge',
        price: 'Preis',
        total: 'Gesamt',
        subtotal: 'Zwischensumme (Netto)',
        shipping: 'Versand',
        vat: 'MwSt.',
        grandTotal: 'Gesamtbetrag',
        shippingTo: 'Lieferadresse',
        payment: 'Zahlungsart',
        footer: 'Bei Fragen kontaktieren Sie uns unter support@tigoenergy.shop',
        thankYou: 'Vielen Dank, dass Sie sich für Tigo Energy entschieden haben!',
        customsTitle: 'Wichtig: Zölle & Einfuhrabgaben',
        customsBody: 'Diese Bestellung wird außerhalb der Europäischen Union versendet. Zölle, Einfuhrsteuern und sonstige Gebühren sind NICHT im Bestellbetrag enthalten und liegen in der alleinigen Verantwortung des Käufers. Bitte erkundigen Sie sich bei Ihrer zuständigen Zollbehörde über mögliche Zusatzkosten, bevor Ihre Sendung eintrifft. Falls die Zustellung aufgrund nicht bezahlter Zollgebühren fehlschlägt und die Ware an uns zurückgesendet wird, fällt eine Wiedereinlagerungsgebühr an.',
        paymentInstructions: 'Zahlungsanweisungen',
        bankRegular: 'Reguläre Geschwindigkeit',
        bankFaster: 'Schneller',
        paymentReference: 'Zahlungsreferenz',
        payNowWise: 'Jetzt mit Wise bezahlen',
        lowStockTitle: 'Lagerbestandsprüfung erforderlich',
        lowStockBody: 'Einige Artikel Ihrer Bestellung haben eine begrenzte Verfügbarkeit. Unser Team wird den Bestand prüfen und Ihnen innerhalb von 24 Stunden eine Bestätigung senden. Falls Artikel nicht verfügbar sind, werden wir Sie kontaktieren.',
        paymentProofTitle: 'Zahlung vor Abholung erforderlich',
        paymentProofBody: 'Dies ist eine Selbstabholbestellung. Sie müssen dem Lagerpersonal einen Zahlungsnachweis (Banküberweisung) vorlegen, bevor die Ware ausgehändigt wird. Ohne verifizierten Zahlungsnachweis werden keine Artikel herausgegeben.',
    },
    fr: {
        subject: 'Confirmation de commande — #{orderNumber}',
        greeting: 'Bonjour {name},',
        thanks: 'Merci pour votre commande ! Voici le récapitulatif :',
        orderNumber: 'Numéro de commande',
        sku: 'Réf.',
        product: 'Produit',
        qty: 'Qté',
        price: 'Prix',
        total: 'Total',
        subtotal: 'Sous-total (HT)',
        shipping: 'Livraison',
        vat: 'TVA',
        grandTotal: 'Total TTC',
        shippingTo: 'Adresse de livraison',
        payment: 'Mode de paiement',
        footer: 'Pour toute question, contactez-nous à support@tigoenergy.shop',
        thankYou: 'Merci d\'avoir choisi Tigo Energy !',
        customsTitle: 'Important : Droits de douane et taxes d\'importation',
        customsBody: 'Cette commande est expédiée en dehors de l\'Union européenne. Les droits de douane, taxes d\'importation et autres frais ne sont PAS inclus dans le montant total et sont à la charge exclusive de l\'acheteur. Veuillez contacter votre autorité douanière locale pour connaître les frais supplémentaires avant l\'arrivée de votre envoi. En cas d\'échec de livraison dû au non-paiement des droits de douane et de retour des marchandises, des frais de réapprovisionnement seront appliqués.',
        paymentInstructions: 'Instructions de paiement',
        bankRegular: 'Vitesse régulière',
        bankFaster: 'Plus rapide',
        paymentReference: 'Référence de paiement',
        payNowWise: 'Payer maintenant avec Wise',
        lowStockTitle: 'Vérification du stock requise',
        lowStockBody: 'Certains articles de votre commande ont une disponibilité limitée. Notre équipe vérifiera le stock et vous enverra un e-mail de confirmation sous 24 heures. Si des articles ne sont pas disponibles, nous vous contacterons.',
        paymentProofTitle: 'Paiement requis avant le retrait',
        paymentProofBody: 'Ceci est une commande de retrait en personne. Vous devez présenter une preuve de paiement (confirmation de virement bancaire) au personnel de l\'entrepôt avant que les articles ne soient remis. Aucun article ne sera remis sans preuve de paiement vérifiée.',
    },
    it: {
        subject: 'Conferma ordine — #{orderNumber}',
        greeting: 'Ciao {name},',
        thanks: 'Grazie per il tuo ordine! Ecco il riepilogo:',
        orderNumber: 'Numero ordine',
        sku: 'Cod.',
        product: 'Prodotto',
        qty: 'Qtà',
        price: 'Prezzo',
        total: 'Totale',
        subtotal: 'Subtotale (Netto)',
        shipping: 'Spedizione',
        vat: 'IVA',
        grandTotal: 'Totale Complessivo',
        shippingTo: 'Indirizzo di spedizione',
        payment: 'Metodo di pagamento',
        footer: 'Per domande, contattaci a support@tigoenergy.shop',
        thankYou: 'Grazie per aver scelto Tigo Energy!',
        customsTitle: 'Importante: Dazi doganali e tasse di importazione',
        customsBody: 'Questo ordine viene spedito al di fuori dell\'Unione Europea. Dazi doganali, tasse di importazione e altri oneri NON sono inclusi nel totale dell\'ordine e sono a carico esclusivo dell\'acquirente. Si prega di contattare l\'autorità doganale locale per determinare eventuali costi aggiuntivi prima dell\'arrivo della spedizione. In caso di mancata consegna per mancato pagamento dei dazi doganali e restituzione della merce, verrà applicata una tariffa di riassortimento.',
        paymentInstructions: 'Istruzioni per il pagamento',
        bankRegular: 'Velocità regolare',
        bankFaster: 'Più veloce',
        paymentReference: 'Riferimento pagamento',
        payNowWise: 'Paga ora con Wise',
        lowStockTitle: 'Verifica disponibilità richiesta',
        lowStockBody: 'Alcuni articoli del tuo ordine hanno disponibilità limitata. Il nostro team verificherà la disponibilità e ti invierà un\'e-mail di conferma entro 24 ore. Se alcuni articoli non sono disponibili, ti contatteremo.',
        paymentProofTitle: 'Pagamento richiesto prima del ritiro',
        paymentProofBody: 'Questo è un ordine con ritiro in sede. È necessario presentare una prova di pagamento (conferma di bonifico bancario) al personale del magazzino prima del rilascio della merce. Nessun articolo verrà consegnato senza prova di pagamento verificata.',
    },
    sl: {
        subject: 'Potrditev naročila — #{orderNumber}',
        greeting: 'Pozdravljeni {name},',
        thanks: 'Hvala za vaše naročilo! Tukaj je povzetek:',
        orderNumber: 'Številka naročila',
        sku: 'Šifra',
        product: 'Izdelek',
        qty: 'Kol.',
        price: 'Cena',
        total: 'Skupaj',
        subtotal: 'Vmesna vsota (Neto)',
        shipping: 'Dostava',
        vat: 'DDV',
        grandTotal: 'Skupni znesek',
        shippingTo: 'Naslov dostave',
        payment: 'Način plačila',
        footer: 'Za vprašanja nas kontaktirajte na support@tigoenergy.shop',
        thankYou: 'Hvala, ker ste izbrali Tigo Energy!',
        customsTitle: 'Pomembno: Carinske dajatve in uvozne takse',
        customsBody: 'To naročilo se pošilja izven Evropske unije. Carinske dajatve, uvozni davki in druge pristojbine NISO vključene v skupni znesek naročila in so izključno odgovornost kupca. Pred prihodom pošiljke se prosim obrnite na pristojni carinski organ za informacije o morebitnih dodatnih stroških. V primeru neuspešne dostave zaradi neplačanih carinskih dajatev in vračila blaga se zaračuna pristojbina za vračilo na zalogo.',
        paymentInstructions: 'Navodila za plačilo',
        bankRegular: 'Običajna hitrost',
        bankFaster: 'Hitrejše',
        paymentReference: 'Referenca plačila',
        payNowWise: 'Plačaj zdaj z Wise',
        lowStockTitle: 'Potrebna preverba zalog',
        lowStockBody: 'Nekateri artikli vašega naročila imajo omejeno razpoložljivost. Naša ekipa bo preverila zaloge in vam v 24 urah poslala potrditveno e-pošto. Če kateri izdelek ni na voljo, vas bomo kontaktirali za dogovor o alternativah.',
        paymentProofTitle: 'Plačilo obvezno pred prevzemom',
        paymentProofBody: 'To je naročilo z osebnim prevzemom. Pred prevzemom blaga morate skladiščnemu osebju predložiti dokazilo o plačilu (potrdilo o bančnem nakazilu). Brez preverjenega dokazila o plačilu blago NE bo izdano.',
    },
    es: {
        subject: 'Confirmación de pedido — #{orderNumber}',
        greeting: 'Hola {name},',
        thanks: '¡Gracias por tu pedido! Aquí tienes el resumen:',
        orderNumber: 'Número de pedido',
        sku: 'Ref.',
        product: 'Producto',
        qty: 'Cant.',
        price: 'Precio',
        total: 'Total',
        subtotal: 'Subtotal (Neto)',
        shipping: 'Envío',
        vat: 'IVA',
        grandTotal: 'Total General',
        shippingTo: 'Dirección de envío',
        payment: 'Método de pago',
        footer: 'Si tienes preguntas, contáctanos en support@tigoenergy.shop',
        thankYou: '¡Gracias por elegir Tigo Energy!',
        customsTitle: 'Importante: Aranceles aduaneros e impuestos de importación',
        customsBody: 'Este pedido se envía fuera de la Unión Europea. Los aranceles aduaneros, impuestos de importación y otros cargos NO están incluidos en el total del pedido y son responsabilidad exclusiva del comprador. Contacte con su autoridad aduanera local para conocer los posibles cargos adicionales antes de la llegada de su envío. Si la entrega falla debido al impago de los derechos de aduana y la mercancía nos es devuelta, se aplicará una tarifa de reposición.',
        paymentInstructions: 'Instrucciones de pago',
        bankRegular: 'Velocidad regular',
        bankFaster: 'Más rápido',
        paymentReference: 'Referencia de pago',
        payNowWise: 'Pagar ahora con Wise',
        lowStockTitle: 'Verificación de stock requerida',
        lowStockBody: 'Algunos artículos de su pedido tienen disponibilidad limitada. Nuestro equipo verificará el stock y le enviará un correo de confirmación en 24 horas. Si algún artículo no está disponible, nos pondremos en contacto con usted.',
        paymentProofTitle: 'Pago requerido antes de la recogida',
        paymentProofBody: 'Este es un pedido de recogida personal. Debe presentar un comprobante de pago (confirmación de transferencia bancaria) al personal del almacén antes de la entrega. No se entregarán artículos sin comprobante de pago verificado.',
    },
    hr: {
        subject: 'Potvrda narudžbe — #{orderNumber}',
        greeting: 'Pozdrav {name},',
        thanks: 'Hvala na narudžbi! Evo pregleda:',
        orderNumber: 'Broj narudžbe',
        sku: 'Šifra',
        product: 'Proizvod',
        qty: 'Kol.',
        price: 'Cijena',
        total: 'Ukupno',
        subtotal: 'Podzbroj (Neto)',
        shipping: 'Dostava',
        vat: 'PDV',
        grandTotal: 'Ukupni iznos',
        shippingTo: 'Adresa dostave',
        payment: 'Način plaćanja',
        footer: 'Za pitanja nas kontaktirajte na support@tigoenergy.shop',
        thankYou: 'Hvala što ste odabrali Tigo Energy!',
        customsTitle: 'Važno: Carine i uvozne pristojbe',
        customsBody: 'Ova narudžba se šalje izvan Europske unije. Carine, uvozni porezi i druge pristojbe NISU uključeni u ukupni iznos narudžbe i isključiva su odgovornost kupca. Molimo kontaktirajte lokalnu carinsku službu za informacije o dodatnim troškovima prije dolaska pošiljke. Ako dostava ne uspije zbog neplaćenih carina i roba nam bude vraćena, naplatit će se naknada za povrat na skladište.',
        paymentInstructions: 'Upute za plaćanje',
        bankRegular: 'Redovna brzina',
        bankFaster: 'Brže',
        paymentReference: 'Referenca plaćanja',
        payNowWise: 'Plati sada putem Wise',
        lowStockTitle: 'Potrebna provjera zaliha',
        lowStockBody: 'Neki artikli iz vaše narudžbe imaju ograničenu dostupnost. Naš tim će provjeriti zalihe i poslati vam potvrdu e-poštom u roku od 24 sata. Ako neki artikli nisu dostupni, kontaktirat ćemo vas.',
        paymentProofTitle: 'Plaćanje obvezno prije preuzimanja',
        paymentProofBody: 'Ovo je narudžba s osobnim preuzimanjem. Morate predočiti dokaz o plaćanju (potvrdu bankovnog prijenosa) skladišnom osoblju prije preuzimanja robe. Roba NEĆE biti izdana bez verificiranog dokaza o plaćanju.',
    },
    cs: {
        subject: 'Potvrzení objednávky — #{orderNumber}',
        greeting: 'Dobrý den {name},',
        thanks: 'Děkujeme za vaši objednávku! Zde je přehled:',
        orderNumber: 'Číslo objednávky',
        sku: 'Kód',
        product: 'Produkt',
        qty: 'Mn.',
        price: 'Cena',
        total: 'Celkem',
        subtotal: 'Mezisoučet (Netto)',
        shipping: 'Doprava',
        vat: 'DPH',
        grandTotal: 'Celková částka',
        shippingTo: 'Adresa doručení',
        payment: 'Platební metoda',
        footer: 'Máte-li dotazy, kontaktujte nás na support@tigoenergy.shop',
        thankYou: 'Děkujeme, že jste si vybrali Tigo Energy!',
        customsTitle: 'Důležité: Cla a dovozní poplatky',
        customsBody: 'Tato objednávka je zasílána mimo Evropskou unii. Cla, dovozní daně a další poplatky NEJSOU zahrnuty v celkové částce objednávky a jsou výhradní odpovědností kupujícího. Před příjezdem zásilky kontaktujte místní celní úřad pro zjištění případných dodatečných poplatků. V případě neúspěšného doručení z důvodu nezaplacených cel a vrácení zboží bude účtován poplatek za naskladnění.',
        paymentInstructions: 'Platební pokyny',
        bankRegular: 'Standardní rychlost',
        bankFaster: 'Rychlejší',
        paymentReference: 'Platební reference',
        payNowWise: 'Zaplatit nyní přes Wise',
        lowStockTitle: 'Vyžadováno ověření skladu',
        lowStockBody: 'Některé položky vaší objednávky mají omezenou dostupnost. Náš tým ověří dostupnost a do 24 hodin vám zašle potvrzovací e-mail. Pokud některé položky nejsou k dispozici, budeme vás kontaktovat.',
        paymentProofTitle: 'Platba vyžadována před vyzvednutím',
        paymentProofBody: 'Jedná se o objednávku s osobním odběrem. Před vydáním zboží musíte skladovému personálu předložit doklad o platbě (potvrzení bankovního převodu). Bez ověřeného dokladu o platbě zboží NEBUDE vydáno.',
    },
    sk: {
        subject: 'Potvrdenie objednávky — #{orderNumber}',
        greeting: 'Dobrý deň {name},',
        thanks: 'Ďakujeme za vašu objednávku! Tu je prehľad:',
        orderNumber: 'Číslo objednávky',
        sku: 'Kód',
        product: 'Produkt',
        qty: 'Mn.',
        price: 'Cena',
        total: 'Celkom',
        subtotal: 'Medzisúčet (Netto)',
        shipping: 'Doprava',
        vat: 'DPH',
        grandTotal: 'Celková suma',
        shippingTo: 'Adresa doručenia',
        payment: 'Platobná metóda',
        footer: 'Máte otázky? Kontaktujte nás na support@tigoenergy.shop',
        thankYou: 'Ďakujeme, že ste si vybrali Tigo Energy!',
        customsTitle: 'Dôležité: Clá a dovozné poplatky',
        customsBody: 'Táto objednávka je zasielaná mimo Európsku úniu. Clá, dovozné dane a ďalšie poplatky NIE SÚ zahrnuté v celkovej sume objednávky a sú výhradnou zodpovednosťou kupujúceho. Pred príchodom zásielky kontaktujte miestny colný úrad pre zistenie prípadných dodatočných poplatkov. V prípade neúspešného doručenia z dôvodu nezaplatených ciel a vrátenia tovaru bude účtovaný poplatok za naskladnenie.',
        paymentInstructions: 'Platobné pokyny',
        bankRegular: 'Štandardná rýchlosť',
        bankFaster: 'Rýchlejšie',
        paymentReference: 'Platobná referencia',
        payNowWise: 'Zaplatiť teraz cez Wise',
        lowStockTitle: 'Vyžadované overenie skladu',
        lowStockBody: 'Niektoré položky vašej objednávky majú obmedzenú dostupnosť. Náš tím overí dostupnosť a do 24 hodín vám zašle potvrdzovací e-mail. Ak niektoré položky nie sú k dispozícii, budeme vás kontaktovať.',
        paymentProofTitle: 'Platba vyžadovaná pred vyzdvihnutím',
        paymentProofBody: 'Ide o objednávku s osobným odberom. Pred vydaním tovaru musíte skladovému personálu predložiť doklad o platbe (potvrdenie bankového prevodu). Bez overeného dokladu o platbe tovar NEBUDE vydaný.',
    },
    sv: {
        subject: 'Orderbekräftelse — #{orderNumber}',
        greeting: 'Hej {name},',
        thanks: 'Tack för din beställning! Här är din ordersammanfattning:',
        orderNumber: 'Ordernummer',
        sku: 'Art.nr.',
        product: 'Produkt',
        qty: 'Antal',
        price: 'Pris',
        total: 'Totalt',
        subtotal: 'Delsumma (Netto)',
        shipping: 'Frakt',
        vat: 'Moms',
        grandTotal: 'Totalt belopp',
        shippingTo: 'Leveransadress',
        payment: 'Betalningsmetod',
        footer: 'Har du frågor? Kontakta oss på support@tigoenergy.shop',
        thankYou: 'Tack för att du valde Tigo Energy!',
        customsTitle: 'Viktigt: Tullavgifter och importskatter',
        customsBody: 'Denna beställning skickas utanför Europeiska unionen. Tullavgifter, importskatter och andra avgifter INGÅR INTE i ordertotalen och är köparens enskilda ansvar. Kontakta din lokala tullmyndighet för att fastställa eventuella tillkommande avgifter innan din leverans anländer. Om leveransen misslyckas på grund av obetalda tullavgifter och varorna returneras till oss, tillkommer en återlageringsavgift.',
        paymentInstructions: 'Betalningsinstruktioner',
        bankRegular: 'Standardhastighet',
        bankFaster: 'Snabbare',
        paymentReference: 'Betalningsreferens',
        payNowWise: 'Betala nu med Wise',
        lowStockTitle: 'Lagerverifiering krävs',
        lowStockBody: 'Vissa artiklar i din beställning har begränsad tillgänglighet. Vårt team kommer att verifiera lagerstatus och skicka dig en bekräftelse via e-post inom 24 timmar. Om några artiklar inte finns tillgängliga kontaktar vi dig.',
        paymentProofTitle: 'Betalning krävs före upphämtning',
        paymentProofBody: 'Detta är en order med personlig upphämtning. Du måste visa betalningsbevis (bekräftelse på banköverföring) till vår lagerpersonal innan varor lämnas ut. Varor kommer INTE att lämnas ut utan verifierat betalningsbevis.',
    },
}

function getLabels(lang: string) {
    return LABELS[lang] || LABELS.en
}

function fmt(amount: number, currency: string) {
    return `${currency} ${amount.toFixed(2)}`
}

export function buildOrderConfirmationEmail(data: OrderEmailData) {
    const l = getLabels(data.language)
    const addr = data.shippingAddress

    const subject = l.subject.replace('{orderNumber}', data.orderNumber)
    const greeting = l.greeting.replace('{name}', data.customerName)

    const itemRows = data.items.map(item => {
        const hasDiscount = item.originalUnitPrice && item.originalUnitPrice > item.unitPrice
        return `
        <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#666">${item.sku}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px">${item.name}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:center">${item.quantity}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:right">
                ${hasDiscount ? `<div style="text-decoration:line-through;color:#999;font-size:11px">${fmt(item.originalUnitPrice!, data.currency)}</div>` : ''}
                ${fmt(item.unitPrice, data.currency)}
            </td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:right;font-weight:600">${fmt(item.totalPrice, data.currency)}</td>
        </tr>
    `}).join('')

    const html = `
<!DOCTYPE html>
<html lang="${data.language}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:640px;margin:0 auto;padding:24px">

    <!-- Header -->
    <div style="background:#16a34a;padding:5px 0;text-align:center;border-radius:12px 12px 0 0;">
        <img src="https://tigoenergy.shop/tigo-logo-white.png" alt="Tigo Energy" style="height:20px; width:auto; display:block; margin:0 auto;">
    </div>
    <div style="background:#f9fafb; padding:8px; text-align:center; border-bottom:1px solid #e5e7eb; border-left:1px solid #e5e7eb; border-right:1px solid #e5e7eb;">
        <p style="color:#666;margin:0;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px">${l.orderNumber}: ${data.orderNumber}</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none">
        <p style="font-size:16px;color:#111;margin:0 0 8px">${greeting}</p>
        <p style="font-size:14px;color:#555;margin:0 0 24px">${l.thanks}</p>

        <!-- Items Table -->
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px">
            <thead>
                <tr style="background:#f9fafb">
                    <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#888;letter-spacing:0.5px">${l.sku}</th>
                    <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#888;letter-spacing:0.5px">${l.product}</th>
                    <th style="padding:10px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#888;letter-spacing:0.5px">${l.qty}</th>
                    <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#888;letter-spacing:0.5px">${l.price}</th>
                    <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#888;letter-spacing:0.5px">${l.total}</th>
                </tr>
            </thead>
            <tbody>
                ${itemRows}
            </tbody>
        </table>

        <!-- Totals -->
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px">
            <tr><td style="padding:6px 0;font-size:14px;color:#666">${l.subtotal}</td><td style="padding:6px 0;font-size:14px;text-align:right">${fmt(data.subtotal, data.currency)}</td></tr>
            <tr><td style="padding:6px 0;font-size:14px;color:#666">${l.shipping}</td><td style="padding:6px 0;font-size:14px;text-align:right">${data.shippingCost === 0 ? 'FREE' : fmt(data.shippingCost, data.currency)}</td></tr>
            ${data.vatAmount > 0 ? `<tr><td style="padding:6px 0;font-size:14px;color:#666">${l.vat}</td><td style="padding:6px 0;font-size:14px;text-align:right">${fmt(data.vatAmount, data.currency)}</td></tr>` : ''}
            <tr style="border-top:2px solid #e5e7eb"><td style="padding:12px 0 0;font-size:18px;font-weight:700;color:#111">${l.grandTotal}</td><td style="padding:12px 0 0;font-size:18px;font-weight:700;color:#458400;text-align:right">${fmt(data.total, data.currency)}</td></tr>
        </table>

        <!-- Shipping & Payment -->
        <div style="display:flex;gap:24px;margin-bottom:24px">
            <div style="flex:1">
                <h3 style="font-size:12px;text-transform:uppercase;color:#888;letter-spacing:0.5px;margin:0 0 8px">${l.shippingTo}</h3>
                <p style="font-size:14px;color:#333;margin:0;line-height:1.6">
                    ${addr.first_name || ''} ${addr.last_name || ''}<br>
                    ${addr.street || ''}${addr.street2 ? `<br>${addr.street2}` : ''}<br>
                    ${addr.postal_code || ''} ${addr.city || ''}<br>
                    ${addr.country || ''}
                </p>
            </div>
            <div style="flex:1">
                <h3 style="font-size:12px;text-transform:uppercase;color:#888;letter-spacing:0.5px;margin:0 0 8px">${l.payment}</h3>
                <p style="font-size:14px;color:#333;margin:0">${data.paymentMethod.replace(/_/g, ' ').toUpperCase()}</p>
            </div>
        </div>

        <!-- Bank Details -->
        <div style="background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;padding:20px;margin-bottom:24px">
            <h3 style="font-size:14px;font-weight:700;color:#92400e;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.5px">${l.paymentInstructions || 'Payment Instructions'}</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
                <tr>
                    <td style="padding:8px 12px;vertical-align:top;width:50%">
                        <p style="font-size:10px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px">${l.bankRegular || 'Regular speed'}</p>
                        <p style="font-size:11px;color:#666;margin:0 0 2px">IBAN</p>
                        <p style="font-size:13px;font-weight:700;color:#111;font-family:monospace;margin:0 0 8px">SI56 6100 0002 8944 371</p>
                        <p style="font-size:11px;color:#666;margin:0 0 2px">BIC/SWIFT</p>
                        <p style="font-size:13px;font-weight:700;color:#111;font-family:monospace;margin:0">HDELSI22</p>
                    </td>
                    <td style="padding:8px 12px;vertical-align:top;width:50%">
                        <p style="font-size:10px;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px">${l.bankFaster || 'Faster'}</p>
                        <p style="font-size:11px;color:#666;margin:0 0 2px">IBAN</p>
                        <p style="font-size:13px;font-weight:700;color:#111;font-family:monospace;margin:0 0 8px">BE55 9052 7486 2944</p>
                        <p style="font-size:11px;color:#666;margin:0 0 2px">BIC/SWIFT</p>
                        <p style="font-size:13px;font-weight:700;color:#111;font-family:monospace;margin:0">TRWIBEB1XXX</p>
                    </td>
                </tr>
            </table>
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:12px;margin-top:12px">
                <p style="font-size:11px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px">${l.paymentReference || 'Payment Reference'}</p>
                <p style="font-size:18px;font-weight:900;color:#1e3a5f;font-family:monospace;margin:0">SI00 ${data.orderNumber.replace('ETRG-ORD-', '').slice(-6)}</p>
            </div>
            <div style="text-align:center;margin-top:16px">
                <a href="https://wise.com/pay/business/initraenergijadoo?amount=${data.total.toFixed(2)}&currency=${data.currency}&description=${data.orderNumber.replace('ETRG-ORD-', '').slice(-6)}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none">${l.payNowWise || 'Pay Now with Wise'}</a>
            </div>
        </div>

        ${data.isLowStock ? `
        <div style="background:#fff7ed;border:1px solid #f97316;border-radius:8px;padding:16px;margin-bottom:24px">
            <p style="font-size:14px;font-weight:700;color:#9a3412;margin:0 0 8px">⏳ ${l.lowStockTitle || LABELS.en.lowStockTitle}</p>
            <p style="font-size:13px;color:#9a3412;margin:0;line-height:1.5">${l.lowStockBody || LABELS.en.lowStockBody}</p>
        </div>
        ` : ''}

        ${data.pickupPaymentProofRequired ? `
        <div style="background:#fef2f2;border:2px solid #ef4444;border-radius:8px;padding:16px;margin-bottom:24px">
            <p style="font-size:14px;font-weight:700;color:#dc2626;margin:0 0 8px">🚨 ${l.paymentProofTitle || LABELS.en.paymentProofTitle}</p>
            <p style="font-size:13px;color:#991b1b;margin:0;line-height:1.5">${l.paymentProofBody || LABELS.en.paymentProofBody}</p>
        </div>
        ` : ''}

        ${data.isExport ? `
        <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin-bottom:24px">
            <p style="font-size:14px;font-weight:700;color:#92400e;margin:0 0 8px">⚠️ ${l.customsTitle}</p>
            <p style="font-size:13px;color:#92400e;margin:0;line-height:1.5">${l.customsBody}</p>
        </div>
        ` : ''}

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
        <p style="font-size:13px;color:#888;text-align:center;margin:0 0 4px">${l.footer}</p>
        <p style="font-size:13px;color:#458400;text-align:center;font-weight:600;margin:0">${l.thankYou}</p>
    </div>
</div>
</body>
</html>`

    return { subject, html }
}
