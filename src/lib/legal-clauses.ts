/**
 * Legal clause translations for invoices and packing slips.
 * Each entry: { invoiceTitle, invoiceBody, packingTitle, packingBody, packingB2B }
 */

export type LegalClauseLang = {
    invoiceTitle: string
    invoiceBody: string
    packingTitle: string
    packingBody: string
    packingB2BAddition: string
}

export const LEGAL_CLAUSES: Record<string, LegalClauseLang> = {
    en: {
        invoiceTitle: 'TERMS & CONDITIONS',
        invoiceBody: 'All sales are final. No returns are accepted unless specifically authorized in writing by the seller at the seller\'s sole discretion. All product warranties are provided exclusively by the manufacturer. The seller makes no warranties, express or implied, regarding any products or their fitness for a particular purpose or uninterrupted operation.',
        packingTitle: 'IMPORTANT — GOODS INSPECTION NOTICE',
        packingBody: 'Please inspect all goods upon receipt. Any damage, shortages, or discrepancies must be reported to us at support@tigoenergy.shop within <strong>24 hours of delivery</strong>. The delivery timestamp recorded by the carrier (e.g. DPD scan or delivery notification) constitutes the start of this 24-hour window. Claims received after this period will not be considered.',
        packingB2BAddition: 'All sales are final. No returns unless specifically authorized in writing by the seller. All warranties via manufacturer only; seller makes no product warranties.',
    },
    sl: {
        invoiceTitle: 'POGOJI POSLOVANJA',
        invoiceBody: 'Vsa prodaja je dokončna. Vračilo blaga ni možno, razen če ga pisno odobri prodajalec po lastni presoji. Vse garancije za izdelke zagotavlja izključno proizvajalec. Prodajalec ne daje nobenih garancij, izrecnih ali implicitnih, glede izdelkov ali njihove ustreznosti za določen namen oziroma neprekinjenega delovanja.',
        packingTitle: 'POMEMBNO — PREGLED BLAGA OB PREVZEMU',
        packingBody: 'Prosimo, preglejte vse blago ob prevzemu. Morebitne poškodbe, manjkajoče količine ali neskladnosti je potrebno prijaviti na support@tigoenergy.shop v roku <strong>24 ur od dostave</strong>. Čas dostave, ki ga zabeleži prevoznik (npr. sken DPD ali obvestilo o dostavi), šteje kot začetek tega 24-urnega roka. Reklamacije po tem roku ne bodo upoštevane.',
        packingB2BAddition: 'Vsa prodaja je dokončna. Vračilo ni možno brez pisne odobritve prodajalca. Garancije zagotavlja izključno proizvajalec; prodajalec ne jamči za izdelke.',
    },
    de: {
        invoiceTitle: 'ALLGEMEINE GESCHÄFTSBEDINGUNGEN',
        invoiceBody: 'Alle Verkäufe sind endgültig. Rückgaben werden nur akzeptiert, wenn sie vom Verkäufer ausdrücklich schriftlich genehmigt wurden. Alle Produktgarantien werden ausschließlich vom Hersteller gewährt. Der Verkäufer gibt keinerlei ausdrückliche oder stillschweigende Garantien hinsichtlich der Produkte, ihrer Eignung für einen bestimmten Zweck oder ihres unterbrechungsfreien Betriebs.',
        packingTitle: 'WICHTIG — WARENPRÜFUNG BEI ERHALT',
        packingBody: 'Bitte prüfen Sie alle Waren bei Erhalt. Schäden, Fehlmengen oder Abweichungen sind uns unter support@tigoenergy.shop innerhalb von <strong>24 Stunden nach Lieferung</strong> zu melden. Der vom Spediteur erfasste Lieferzeitpunkt (z. B. DPD-Scan oder Zustellbenachrichtigung) gilt als Beginn dieser 24-Stunden-Frist. Reklamationen nach diesem Zeitraum werden nicht berücksichtigt.',
        packingB2BAddition: 'Alle Verkäufe sind endgültig. Rückgaben nur mit schriftlicher Genehmigung des Verkäufers. Alle Garantien über den Hersteller; Verkäufer übernimmt keine Produkthaftung.',
    },
    fr: {
        invoiceTitle: 'CONDITIONS GÉNÉRALES DE VENTE',
        invoiceBody: 'Toute vente est définitive. Aucun retour n\'est accepté sauf autorisation écrite expresse du vendeur, à sa seule discrétion. Toutes les garanties produits sont fournies exclusivement par le fabricant. Le vendeur ne donne aucune garantie, expresse ou implicite, concernant les produits, leur adéquation à un usage particulier ou leur fonctionnement ininterrompu.',
        packingTitle: 'IMPORTANT — AVIS D\'INSPECTION DES MARCHANDISES',
        packingBody: 'Veuillez inspecter toutes les marchandises à la réception. Tout dommage, manque ou écart doit nous être signalé à support@tigoenergy.shop dans les <strong>24 heures suivant la livraison</strong>. L\'horodatage de livraison enregistré par le transporteur (ex. scan DPD ou notification de livraison) marque le début de cette période de 24 heures. Les réclamations reçues après ce délai ne seront pas prises en compte.',
        packingB2BAddition: 'Toute vente est définitive. Aucun retour sans autorisation écrite du vendeur. Toutes les garanties via le fabricant uniquement ; le vendeur ne garantit pas les produits.',
    },
    it: {
        invoiceTitle: 'TERMINI E CONDIZIONI',
        invoiceBody: 'Tutte le vendite sono definitive. Non sono accettati resi salvo autorizzazione scritta specifica del venditore, a sua esclusiva discrezione. Tutte le garanzie sui prodotti sono fornite esclusivamente dal produttore. Il venditore non fornisce alcuna garanzia, espressa o implicita, riguardo ai prodotti, alla loro idoneità per uno scopo specifico o al funzionamento ininterrotto.',
        packingTitle: 'IMPORTANTE — AVVISO DI ISPEZIONE MERCI',
        packingBody: 'Si prega di ispezionare tutte le merci al ricevimento. Eventuali danni, ammanchi o discrepanze devono essere segnalati a support@tigoenergy.shop entro <strong>24 ore dalla consegna</strong>. Il timestamp di consegna registrato dal corriere (es. scansione DPD o notifica di consegna) costituisce l\'inizio di questa finestra di 24 ore. I reclami ricevuti dopo tale periodo non saranno presi in considerazione.',
        packingB2BAddition: 'Tutte le vendite sono definitive. Nessun reso senza autorizzazione scritta del venditore. Tutte le garanzie tramite il produttore; il venditore non garantisce i prodotti.',
    },
    es: {
        invoiceTitle: 'TÉRMINOS Y CONDICIONES',
        invoiceBody: 'Todas las ventas son definitivas. No se aceptan devoluciones salvo autorización escrita expresa del vendedor a su entera discreción. Todas las garantías de productos son proporcionadas exclusivamente por el fabricante. El vendedor no ofrece garantías, expresas ni implícitas, sobre los productos, su idoneidad para un fin particular o su funcionamiento ininterrumpido.',
        packingTitle: 'IMPORTANTE — AVISO DE INSPECCIÓN DE MERCANCÍAS',
        packingBody: 'Por favor inspeccione todas las mercancías al recibirlas. Cualquier daño, faltante o discrepancia debe comunicarse a support@tigoenergy.shop en las <strong>24 horas siguientes a la entrega</strong>. La marca de tiempo de entrega registrada por el transportista (p. ej. escaneo DPD o notificación de entrega) constituye el inicio de este plazo de 24 horas. Las reclamaciones recibidas después de este período no serán atendidas.',
        packingB2BAddition: 'Todas las ventas son definitivas. Sin devoluciones salvo autorización escrita del vendedor. Todas las garantías a través del fabricante; el vendedor no garantiza los productos.',
    },
    pt: {
        invoiceTitle: 'TERMOS E CONDIÇÕES',
        invoiceBody: 'Todas as vendas são definitivas. Não são aceitas devoluções salvo autorização escrita específica do vendedor, a seu exclusivo critério. Todas as garantias dos produtos são fornecidas exclusivamente pelo fabricante. O vendedor não oferece quaisquer garantias, expressas ou implícitas, quanto aos produtos, sua adequação a uma finalidade específica ou funcionamento ininterrupto.',
        packingTitle: 'IMPORTANTE — AVISO DE INSPEÇÃO DE MERCADORIAS',
        packingBody: 'Por favor inspecione todas as mercadorias no recebimento. Quaisquer danos, faltas ou discrepâncias devem ser comunicados a support@tigoenergy.shop dentro de <strong>24 horas após a entrega</strong>. O registo de data/hora da entrega pelo transportador (ex. leitura DPD ou notificação de entrega) constitui o início deste prazo de 24 horas. Reclamações recebidas após este período não serão consideradas.',
        packingB2BAddition: 'Todas as vendas são definitivas. Sem devoluções sem autorização escrita do vendedor. Todas as garantias via fabricante; o vendedor não garante os produtos.',
    },
    nl: {
        invoiceTitle: 'ALGEMENE VOORWAARDEN',
        invoiceBody: 'Alle verkopen zijn definitief. Retouren worden niet geaccepteerd tenzij uitdrukkelijk schriftelijk geautoriseerd door de verkoper naar eigen goeddunken. Alle productgaranties worden uitsluitend verstrekt door de fabrikant. De verkoper biedt geen garanties, expliciet of impliciet, met betrekking tot producten, hun geschiktheid voor een bepaald doel of ononderbroken werking.',
        packingTitle: 'BELANGRIJK — KENNISGEVING GOEDERENINSPECTIE',
        packingBody: 'Inspecteer alle goederen bij ontvangst. Eventuele schade, tekorten of afwijkingen dienen binnen <strong>24 uur na levering</strong> te worden gemeld aan support@tigoenergy.shop. Het door de vervoerder geregistreerde leveringstijdstip (bijv. DPD-scan of bezorgingsbericht) geldt als het begin van dit tijdvenster van 24 uur. Klachten die na deze periode worden ontvangen, worden niet in behandeling genomen.',
        packingB2BAddition: 'Alle verkopen zijn definitief. Geen retouren zonder schriftelijke toestemming van de verkoper. Alle garanties via de fabrikant; verkoper biedt geen productgaranties.',
    },
    hr: {
        invoiceTitle: 'UVJETI I ODREDBE',
        invoiceBody: 'Sve prodaje su konačne. Povrati se ne prihvaćaju osim uz izričitu pisanu odobrenje prodavatelja prema vlastitoj prosudbi. Sva jamstva za proizvode daje isključivo proizvođač. Prodavatelj ne daje nikakva jamstva, izrična ili implicitna, u pogledu proizvoda, njihove prikladnosti za određenu svrhu ili neprekinutog rada.',
        packingTitle: 'VAŽNO — OBAVIJEST O PREGLEDU ROBE',
        packingBody: 'Molimo pregledajte svu robu po primitku. Svaka oštećenja, manjkovi ili neslaganja moraju se prijaviti na support@tigoenergy.shop u roku od <strong>24 sata od dostave</strong>. Vremenski žig dostave koji bilježi prijevoznik (npr. DPD skeniranje ili obavijest o dostavi) označava početak ovog 24-satnog roka. Reklamacije primljene nakon tog roka neće se razmatrati.',
        packingB2BAddition: 'Sve prodaje su konačne. Bez povrata bez pisane odobrenja prodavatelja. Sva jamstva putem proizvođača; prodavatelj ne jamči za proizvode.',
    },
    sr: {
        invoiceTitle: 'USLOVI I ODREDBE',
        invoiceBody: 'Sve prodaje su konačne. Povraćaji se ne prihvataju osim uz izričitu pisanu autorizaciju prodavca prema sopstvenoj proceni. Sve garancije za proizvode daje isključivo proizvođač. Prodavac ne daje nikakve garancije, izričite ili implicitne, u pogledu proizvoda, njihove prikladnosti za određenu svrhu ili nesmetanog rada.',
        packingTitle: 'VAŽNO — OBAVEŠTENJE O PREGLEDU ROBE',
        packingBody: 'Molimo pregledajte svu robu pri preuzimanju. Svaka oštećenja, manjkovi ili neslaganja moraju se prijaviti na support@tigoenergy.shop u roku od <strong>24 sata od isporuke</strong>. Vremenski žig isporuke koji beleži prevoznik (npr. DPD skeniranje ili obaveštenje o isporuci) označava početak ovog 24-časovnog roka. Reklamacije primljene nakon tog roka neće biti razmatrane.',
        packingB2BAddition: 'Sve prodaje su konačne. Bez povraćaja bez pisane autorizacije prodavca. Sve garancije putem proizvođača; prodavac ne garantuje za proizvode.',
    },
    'sr-Cyrl': {
        invoiceTitle: 'УСЛОВИ И ОДРЕДБЕ',
        invoiceBody: 'Све продаје су коначне. Повраћаји се не прихватају осим уз изричиту писану ауторизацију продавца према сопственој процени. Све гаранције за производе даје искључиво произвођач. Продавац не даје никакве гаранције, изричите или имплицитне, у погледу производа, њихове прикладности за одређену сврху или несметаног рада.',
        packingTitle: 'ВАЖНО — ОБАВЕШТЕЊЕ О ПРЕГЛЕДУ РОБЕ',
        packingBody: 'Молимо прегледајте сву робу при преузимању. Свака оштећења, мањкови или несклади морају се пријавити на support@tigoenergy.shop у року од <strong>24 сата од испоруке</strong>. Временски жиг испоруке који бележи превозник (нпр. DPD скенирање или обавештење о испоруци) означава почетак овог 24-часовног рока. Рекламације примљене након тог рока неће бити разматране.',
        packingB2BAddition: 'Све продаје су коначне. Без повраћаја без писане ауторизације продавца. Све гаранције путем произвођача; продавац не гарантује за производе.',
    },
    bg: {
        invoiceTitle: 'ОБЩИ УСЛОВИЯ',
        invoiceBody: 'Всички продажби са окончателни. Връщания не се приемат освен при изрично писмено разрешение от продавача по негова преценка. Всички гаранции за продукти се предоставят единствено от производителя. Продавачът не предоставя никакви гаранции, изрични или подразбиращи се, относно продуктите, тяхната пригодност за определена цел или непрекъснат режим на работа.',
        packingTitle: 'ВАЖНО — УВЕДОМЛЕНИЕ ЗА ПРОВЕРКА НА СТОКИТЕ',
        packingBody: 'Моля, проверете всички стоки при получаване. Всякакви щети, липси или несъответствия трябва да бъдат докладвани на support@tigoenergy.shop в рамките на <strong>24 часа след доставката</strong>. Времевият печат на доставката, регистриран от превозвача (напр. DPD сканиране или уведомление за доставка), бележи началото на този 24-часов период. Рекламации, получени след този период, няма да бъдат разглеждани.',
        packingB2BAddition: 'Всички продажби са окончателни. Без връщания без писмено разрешение от продавача. Всички гаранции чрез производителя; продавачът не гарантира продуктите.',
    },
    mk: {
        invoiceTitle: 'УСЛОВИ И ОДРЕДБИ',
        invoiceBody: 'Сите продажби се конечни. Враќања не се прифаќаат освен со изрична писмена дозвола на продавачот по негова дискреција. Сите гаранции за производи се обезбедуваат исклучиво од производителот. Продавачот не дава никакви гаранции, изрични или имплицитни, во врска со производите, нивната соодветност за одредена намена или непрекинато работење.',
        packingTitle: 'ВАЖНО — ИЗВЕСТУВАЊЕ ЗА ПРЕГЛЕД НА СТОКИ',
        packingBody: 'Ве молиме прегледајте ги сите стоки при примање. Секакви оштетувања, недостатоци или несогласувања мора да се пријават на support@tigoenergy.shop во рок од <strong>24 часа од испораката</strong>. Временскиот печат на испорака забележан од превозникот (на пр. DPD скенирање или известување за испорака) го означува почетокот на овој 24-часовен рок. Рекламациите примени по овој период нема да бидат разгледувани.',
        packingB2BAddition: 'Сите продажби се конечни. Без враќања без писмена дозвола на продавачот. Сите гаранции преку производителот; продавачот не гарантира за производите.',
    },
    pl: {
        invoiceTitle: 'WARUNKI SPRZEDAŻY',
        invoiceBody: 'Wszystkie sprzedaże są ostateczne. Zwroty nie są akceptowane bez wyraźnej pisemnej zgody sprzedawcy według jego własnego uznania. Wszystkie gwarancje na produkty są udzielane wyłącznie przez producenta. Sprzedawca nie udziela żadnych gwarancji, wyraźnych ani dorozumianych, dotyczących produktów, ich przydatności do określonego celu ani nieprzerwanego działania.',
        packingTitle: 'WAŻNE — POWIADOMIENIE O KONTROLI TOWARU',
        packingBody: 'Prosimy o sprawdzenie wszystkich towarów przy odbiorze. Wszelkie uszkodzenia, braki lub niezgodności należy zgłosić na adres support@tigoenergy.shop w ciągu <strong>24 godzin od dostawy</strong>. Znacznik czasu dostawy zarejestrowany przez przewoźnika (np. skan DPD lub powiadomienie o dostarczeniu) stanowi początek tego 24-godzinnego okresu. Reklamacje złożone po tym terminie nie będą rozpatrywane.',
        packingB2BAddition: 'Wszystkie sprzedaże są ostateczne. Bez zwrotów bez pisemnej zgody sprzedawcy. Wszystkie gwarancje przez producenta; sprzedawca nie gwarantuje produktów.',
    },
    cs: {
        invoiceTitle: 'OBCHODNÍ PODMÍNKY',
        invoiceBody: 'Veškerý prodej je konečný. Vrácení zboží není přijímáno bez výslovného písemného souhlasu prodejce dle jeho uvážení. Veškeré záruky na výrobky poskytuje výhradně výrobce. Prodejce neposkytuje žádné záruky, výslovné ani implicitní, ohledně výrobků, jejich vhodnosti pro konkrétní účel ani nepřerušeného provozu.',
        packingTitle: 'DŮLEŽITÉ — UPOZORNĚNÍ NA KONTROLU ZBOŽÍ',
        packingBody: 'Prosíme, zkontrolujte veškeré zboží při přijetí. Jakékoli poškození, chybějící položky nebo nesrovnalosti musí být nahlášeny na support@tigoenergy.shop do <strong>24 hodin od doručení</strong>. Časové razítko doručení zaznamenané přepravcem (např. skenování DPD nebo oznámení o doručení) představuje začátek tohoto 24hodinového okna. Reklamace podané po uplynutí této lhůty nebudou zohledněny.',
        packingB2BAddition: 'Veškerý prodej je konečný. Bez vrácení bez písemného souhlasu prodejce. Veškeré záruky přes výrobce; prodejce neručí za výrobky.',
    },
    sk: {
        invoiceTitle: 'OBCHODNÉ PODMIENKY',
        invoiceBody: 'Každý predaj je konečný. Vrátenie tovaru nie je akceptované bez výslovného písomného súhlasu predajcu podľa jeho uváženia. Všetky záruky na výrobky poskytuje výlučne výrobca. Predajca neposkytuje žiadne záruky, výslovné ani implicitné, týkajúce sa výrobkov, ich vhodnosti na konkrétny účel ani nepretržitej prevádzky.',
        packingTitle: 'DÔLEŽITÉ — UPOZORNENIE NA KONTROLU TOVARU',
        packingBody: 'Prosíme, skontrolujte všetok tovar pri prevzatí. Akékoľvek poškodenia, chýbajúce položky alebo nezrovnalosti musia byť nahlásené na support@tigoenergy.shop do <strong>24 hodín od doručenia</strong>. Časová pečiatka doručenia zaznamenaná prepravcom (napr. skenovanie DPD alebo oznámenie o doručení) predstavuje začiatok tohto 24-hodinového okna. Reklamácie podané po uplynutí tejto lehoty nebudú zohľadnené.',
        packingB2BAddition: 'Každý predaj je konečný. Bez vrátenia bez písomného súhlasu predajcu. Všetky záruky cez výrobcu; predajca neručí za výrobky.',
    },
    hu: {
        invoiceTitle: 'ÁLTALÁNOS SZERZŐDÉSI FELTÉTELEK',
        invoiceBody: 'Minden eladás végleges. Visszáru csak az eladó kifejezett írásos engedélyével fogadható el, az eladó saját belátása szerint. Minden termékgaranciát kizárólag a gyártó biztosít. Az eladó nem vállal semmilyen jótállást, sem kifejezett, sem hallgatólagos formában, a termékekre, azok különleges célra való alkalmasságára vagy zavartalan működésére vonatkozóan.',
        packingTitle: 'FONTOS — ÁRUÁTVÉTELI ELLENŐRZÉSI ÉRTESÍTÉS',
        packingBody: 'Kérjük, átvételkor ellenőrizze az összes árut. Az esetleges sérüléseket, hiányokat vagy eltéréseket a kézbesítéstől számított <strong>24 órán belül</strong> kell bejelenteni a support@tigoenergy.shop címre. A futár által rögzített kézbesítési időbélyeg (pl. DPD-szkennelés vagy kézbesítési értesítés) jelöli a 24 órás időszak kezdetét. Az ezen időszak után beérkezett reklamációkat nem áll módunkban figyelembe venni.',
        packingB2BAddition: 'Minden eladás végleges. Visszáru csak az eladó írásos engedélyével. Minden garancia a gyártón keresztül; az eladó nem garantálja a termékeket.',
    },
    ro: {
        invoiceTitle: 'TERMENI ȘI CONDIȚII',
        invoiceBody: 'Toate vânzările sunt definitive. Nu se acceptă returnări decât cu autorizație scrisă expresă a vânzătorului, la discreția sa exclusivă. Toate garanțiile produselor sunt oferite exclusiv de producător. Vânzătorul nu oferă nicio garanție, expresă sau implicită, cu privire la produse, adecvarea lor pentru un scop specific sau funcționarea neîntreruptă.',
        packingTitle: 'IMPORTANT — NOTIFICARE PRIVIND INSPECȚIA MĂRFURILOR',
        packingBody: 'Vă rugăm să inspectați toate mărfurile la primire. Orice deteriorare, lipsuri sau neconcordanțe trebuie raportate la support@tigoenergy.shop în termen de <strong>24 de ore de la livrare</strong>. Marca temporală a livrării înregistrată de transportator (de ex. scanarea DPD sau notificarea de livrare) constituie începutul acestei ferestre de 24 de ore. Reclamațiile primite după această perioadă nu vor fi luate în considerare.',
        packingB2BAddition: 'Toate vânzările sunt definitive. Fără returnări fără autorizație scrisă a vânzătorului. Toate garanțiile prin producător; vânzătorul nu garantează produsele.',
    },
    da: {
        invoiceTitle: 'VILKÅR OG BETINGELSER',
        invoiceBody: 'Alle salg er endelige. Returneringer accepteres ikke medmindre de er specifikt skriftligt autoriseret af sælgeren efter dennes eget skøn. Alle produktgarantier gives udelukkende af producenten. Sælgeren giver ingen garantier, udtrykkelige eller underforståede, vedrørende produkterne, deres egnethed til et bestemt formål eller uafbrudt drift.',
        packingTitle: 'VIGTIGT — MEDDELELSE OM VAREINSPEKTION',
        packingBody: 'Kontroller venligst alle varer ved modtagelse. Eventuelle skader, mangler eller uoverensstemmelser skal indberettes til support@tigoenergy.shop inden for <strong>24 timer efter levering</strong>. Det leveringstidsstempel, som transportøren registrerer (f.eks. DPD-scanning eller leveringsmeddelelse), udgør starten på dette 24-timers vindue. Reklamationer modtaget efter denne periode vil ikke blive behandlet.',
        packingB2BAddition: 'Alle salg er endelige. Ingen returneringer uden skriftlig autorisation fra sælgeren. Alle garantier via producenten; sælger stiller ingen produktgarantier.',
    },
    sv: {
        invoiceTitle: 'ALLMÄNNA VILLKOR',
        invoiceBody: 'Alla försäljningar är slutgiltiga. Returer accepteras inte utan uttryckligt skriftligt godkännande från säljaren efter dennes eget gottfinnande. Alla produktgarantier tillhandahålls uteslutande av tillverkaren. Säljaren ger inga garantier, uttryckliga eller underförstådda, avseende produkterna, deras lämplighet för ett visst ändamål eller oavbruten drift.',
        packingTitle: 'VIKTIGT — MEDDELANDE OM VARUINSPEKTION',
        packingBody: 'Vänligen inspektera alla varor vid mottagandet. Eventuella skador, brister eller avvikelser måste rapporteras till support@tigoenergy.shop inom <strong>24 timmar efter leverans</strong>. Den leveranstidsstämpel som registreras av transportören (t.ex. DPD-skanning eller leveransavisering) utgör starten på detta 24-timmarsfönster. Reklamationer som inkommer efter denna period kommer inte att beaktas.',
        packingB2BAddition: 'Alla försäljningar är slutgiltiga. Inga returer utan skriftligt godkännande från säljaren. Alla garantier via tillverkaren; säljaren garanterar inte produkterna.',
    },
    no: {
        invoiceTitle: 'VILKÅR OG BETINGELSER',
        invoiceBody: 'Alle salg er endelige. Returer aksepteres ikke med mindre de er spesifikt skriftlig autorisert av selgeren etter dennes eget skjønn. Alle produktgarantier gis utelukkende av produsenten. Selgeren gir ingen garantier, uttrykkelige eller underforståtte, angående produktene, deres egnethet for et bestemt formål eller uavbrutt drift.',
        packingTitle: 'VIKTIG — VAREINSPEKSJONSMELDING',
        packingBody: 'Vennligst inspiser alle varer ved mottak. Eventuelle skader, mangler eller avvik må rapporteres til support@tigoenergy.shop innen <strong>24 timer etter levering</strong>. Leveringstidsstempelet registrert av transportøren (f.eks. DPD-skanning eller leveringsvarsel) utgjør starten på dette 24-timersvinduet. Reklamasjoner mottatt etter denne perioden vil ikke bli vurdert.',
        packingB2BAddition: 'Alle salg er endelige. Ingen returer uten skriftlig autorisasjon fra selgeren. Alle garantier via produsenten; selger garanterer ikke for produktene.',
    },
    fi: {
        invoiceTitle: 'MYYNTIEHDOT',
        invoiceBody: 'Kaikki myynnit ovat lopullisia. Palautuksia ei hyväksytä ilman myyjän nimenomaista kirjallista hyväksyntää myyjän oman harkinnan mukaan. Kaikki tuotetakuut myöntää yksinomaan valmistaja. Myyjä ei anna mitään takuita, nimenomaisia tai implisiittisiä, koskien tuotteita, niiden soveltuvuutta tiettyyn tarkoitukseen tai keskeytymätöntä toimintaa.',
        packingTitle: 'TÄRKEÄÄ — TAVARANTARKASTUSILMOITUS',
        packingBody: 'Tarkasta kaikki tavarat vastaanoton yhteydessä. Mahdolliset vauriot, puutteet tai eroavaisuudet on ilmoitettava osoitteeseen support@tigoenergy.shop <strong>24 tunnin kuluessa toimituksesta</strong>. Rahdinkuljettajan kirjaama toimituksen aikaleima (esim. DPD-skannaus tai toimitusilmoitus) merkitsee tämän 24 tunnin ikkunan alkua. Tämän ajan jälkeen saapuneita reklamaatioita ei oteta huomioon.',
        packingB2BAddition: 'Kaikki myynnit ovat lopullisia. Ei palautuksia ilman myyjän kirjallista hyväksyntää. Kaikki takuut valmistajan kautta; myyjä ei takaa tuotteita.',
    },
    et: {
        invoiceTitle: 'MÜÜGITINGIMUSED',
        invoiceBody: 'Kõik müügid on lõplikud. Tagastusi ei aktsepteerita ilma müüja selgesõnalise kirjaliku loata müüja äranägemisel. Kõik tootega seotud garantiid annab ainult tootja. Müüja ei anna mingeid garantiisid, otseseid ega kaudseid, toodete, nende sobivuse osas konkreetseks otstarbeks või katkematu töö osas.',
        packingTitle: 'TÄHTIS — KAUPADE KONTROLLIMISTEATIS',
        packingBody: 'Palun kontrollige kõiki kaupu kättesaamisel. Kõigist kahjudest, puudustest või lahknevustest tuleb teavitada aadressil support@tigoenergy.shop <strong>24 tunni jooksul pärast kohaletoimetamist</strong>. Vedaja poolt registreeritud kohaletoimetamise ajatempel (nt DPD skannimine või kohaletoimetamise teatis) tähistab selle 24-tunnise akna algust. Pärast seda perioodi saadud pretensioone ei arvestata.',
        packingB2BAddition: 'Kõik müügid on lõplikud. Tagastusi ei aktsepteerita ilma müüja kirjaliku loata. Kõik garantiid tootja kaudu; müüja ei garanteeri tooteid.',
    },
    lv: {
        invoiceTitle: 'PĀRDOŠANAS NOTEIKUMI',
        invoiceBody: 'Visi pārdošanas darījumi ir galīgi. Preču atgriešana netiek pieņemta bez pārdevēja skaidras rakstiskas atļaujas pēc pārdevēja ieskatiem. Visas produktu garantijas sniedz tikai ražotājs. Pārdevējs nesniedz nekādas garantijas, tiešas vai netiešas, attiecībā uz produktiem, to piemērotību konkrētam mērķim vai nepārtrauktu darbību.',
        packingTitle: 'SVARĪGI — PREČU PĀRBAUDES PAZIŅOJUMS',
        packingBody: 'Lūdzu pārbaudiet visas preces saņemšanas brīdī. Par jebkuriem bojājumiem, trūkumiem vai neatbilstībām jāziņo uz support@tigoenergy.shop <strong>24 stundu laikā pēc piegādes</strong>. Pārvadātāja reģistrētais piegādes laika zīmogs (piem., DPD skenēšana vai piegādes paziņojums) iezīmē šī 24 stundu loga sākumu. Sūdzības, kas saņemtas pēc šī perioda, netiks izskatītas.',
        packingB2BAddition: 'Visi pārdošanas darījumi ir galīgi. Nav atgriešanas bez pārdevēja rakstiskas atļaujas. Visas garantijas caur ražotāju; pārdevējs negarantē produktus.',
    },
    lt: {
        invoiceTitle: 'PARDAVIMO SĄLYGOS',
        invoiceBody: 'Visi pardavimai yra galutiniai. Grąžinimai nepriimami be aiškaus raštiško pardavėjo leidimo pardavėjo nuožiūra. Visas produktų garantijas teikia tik gamintojas. Pardavėjas neteikia jokių garantijų, tiesioginių ar numanomų, dėl produktų, jų tinkamumo konkrečiam tikslui ar nepertraukiamo veikimo.',
        packingTitle: 'SVARBU — PREKIŲ PATIKRINIMO PRANEŠIMAS',
        packingBody: 'Prašome patikrinti visas prekes gavimo metu. Apie bet kokius pažeidimus, trūkumus ar neatitikimus reikia pranešti adresu support@tigoenergy.shop per <strong>24 valandas nuo pristatymo</strong>. Vežėjo užfiksuotas pristatymo laiko žymuo (pvz., DPD nuskaitymas ar pristatymo pranešimas) žymi šio 24 valandų lango pradžią. Pretenzijos, gautos po šio laikotarpio, nebus svarstomos.',
        packingB2BAddition: 'Visi pardavimai yra galutiniai. Be grąžinimų be raštiško pardavėjo leidimo. Visos garantijos per gamintoją; pardavėjas negarantuoja produktų.',
    },
}

// Fallback to English if language not found
export function getLegalClauses(lang: string): LegalClauseLang {
    return LEGAL_CLAUSES[lang] || LEGAL_CLAUSES['en']
}
