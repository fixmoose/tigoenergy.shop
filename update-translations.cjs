const fs = require('fs');
const path = require('path');

const SUPPORTED_LOCALES = [
    'en', 'de', 'fr', 'it', 'sl', 'es',
    'nl', 'pl', 'cs', 'sk', 'sv', 'da',
    'ro', 'sr', 'sr-Cyrl', 'mk', 'hr',
    'bg', 'no', 'hu', 'pt', 'lv', 'lt', 'et'
];

// Common translations for all 24 locales
const commonTranslations = {
    en: { addToCart: "Add to Cart", adding: "Adding...", addedToCart: "Added to cart", inStock: "In Stock", outOfStock: "Out of Stock", comingSoon: "Coming Soon" },
    de: { addToCart: "In den Warenkorb", adding: "Wird hinzugefügt...", addedToCart: "Zum Warenkorb hinzugefügt", inStock: "Auf Lager", outOfStock: "Nicht vorrätig", comingSoon: "Demnächst verfügbar" },
    fr: { addToCart: "Ajouter au panier", adding: "Ajout en cours...", addedToCart: "Ajouté au panier", inStock: "En stock", outOfStock: "Rupture de stock", comingSoon: "Bientôt disponible" },
    it: { addToCart: "Aggiungi al carrello", adding: "Aggiunta in corso...", addedToCart: "Aggiunto al carrello", inStock: "Disponibile", outOfStock: "Esaurito", comingSoon: "In arrivo" },
    es: { addToCart: "Agregar al carrito", adding: "Agregando...", addedToCart: "Agregado al carrito", inStock: "En stock", outOfStock: "Agotado", comingSoon: "Próximamente" },
    sl: { addToCart: "Dodaj v košarico", adding: "Dodajanje...", addedToCart: "Dodano v košarico", inStock: "Na zalogi", outOfStock: "Ni na zalogi", comingSoon: "Kmalu" },
    nl: { addToCart: "In winkelwagen", adding: "Toevoegen...", addedToCart: "Toegevoegd aan winkelwagen", inStock: "Op voorraad", outOfStock: "Niet op voorraad", comingSoon: "Binnenkort beschikbaar" },
    pl: { addToCart: "Dodaj do koszyka", adding: "Dodawanie...", addedToCart: "Dodano do koszyka", inStock: "W magazynie", outOfStock: "Brak w magazynie", comingSoon: "Wkrótce dostępne" },
    hr: { addToCart: "Dodaj u košaricu", adding: "Dodavanje...", addedToCart: "Dodano u košaricu", inStock: "Na zalihi", outOfStock: "Nije na zalihi", comingSoon: "Uskoro" },
    cs: { addToCart: "Přidat do košíku", adding: "Přidávání...", addedToCart: "Přidáno do košíku", inStock: "Skladem", outOfStock: "Není skladem", comingSoon: "Již brzy" },
    sk: { addToCart: "Pridať do košíka", adding: "Pridávam...", addedToCart: "Pridané do košíka", inStock: "Na sklade", outOfStock: "Vypredané", comingSoon: "Čoskoro" },
    sv: { addToCart: "Lägg i varukorgen", adding: "Lägger till...", addedToCart: "Lagt i varukorgen", inStock: "I lager", outOfStock: "Slut i lager", comingSoon: "Kommer snart" },
    da: { addToCart: "Tilføj til kurv", adding: "Tilføjer...", addedToCart: "Tilføjet til kurv", inStock: "På lager", outOfStock: "Udsolgt", comingSoon: "Kommer snart" },
    no: { addToCart: "Legg i handlekurven", adding: "Legger til...", addedToCart: "Lagt i handlekurven", inStock: "På lager", outOfStock: "Utsolgt", comingSoon: "Kommer snart" },
    ro: { addToCart: "Adaugă în coș", adding: "Se adaugă...", addedToCart: "Adăugat în coș", inStock: "În stoc", outOfStock: "Stoc epuizat", comingSoon: "În curând" },
    bg: { addToCart: "Добави в количката", adding: "Добавя се...", addedToCart: "Добавено в количката", inStock: "В наличност", outOfStock: "Няма наличност", comingSoon: "Очаквайте скоро" },
    sr: { addToCart: "Dodaj u korpu", adding: "Dodavanje...", addedToCart: "Dodato u korpu", inStock: "Na stanju", outOfStock: "Nema na stanju", comingSoon: "Uskoro" },
    'sr-Cyrl': { addToCart: "Додај у корпу", adding: "Додавање...", addedToCart: "Додато у корпу", inStock: "На стању", outOfStock: "Нема на стању", comingSoon: "Ускоро" },
    mk: { addToCart: "Додади во кошничка", adding: "Додавам...", addedToCart: "Додадено во кошничка", inStock: "На залиха", outOfStock: "Нема на залиха", comingSoon: "Наскоро" },
    hu: { addToCart: "Kosárba", adding: "Hozzáadás...", addedToCart: "Kosárba helyezve", inStock: "Raktáron", outOfStock: "Elfogyott", comingSoon: "Hamarosan" },
    pt: { addToCart: "Adicionar ao Carrinho", adding: "A adicionar...", addedToCart: "Adicionado ao carrinho", inStock: "Em Stock", outOfStock: "Esgotado", comingSoon: "Brevemente" },
    lv: { addToCart: "Pievienot grozam", adding: "Pievieno...", addedToCart: "Pievienots grozam", inStock: "Noliktavā", outOfStock: "Nav noliktavā", comingSoon: "Drīzumā" },
    lt: { addToCart: "Pridėti į krepšelį", adding: "Pridedama...", addedToCart: "Pridėta į krepšelį", inStock: "Sandėlyje", outOfStock: "Nėra sandėlyje", comingSoon: "Netrukus" },
    et: { addToCart: "Lisa ostukorvi", adding: "Lisamine...", addedToCart: "Ostukorvi lisatud", inStock: "Laos", outOfStock: "Otsas", comingSoon: "Tulekul" }
};

const headerTranslations = {
    en: { selectCurrency: "Select Currency", selectLanguage: "Select Language", help: "Help", myCart: "My Cart", cart: "Cart", signIn: "Sign In", account: "Account", signOut: "Sign Out", shopAll: "Shop All" },
    de: { selectCurrency: "Währung wählen", selectLanguage: "Sprache wählen", help: "Hilfe", myCart: "Mein Warenkorb", cart: "Warenkorb", signIn: "Anmelden", account: "Konto", signOut: "Abmelden", shopAll: "Alle Produkte" },
    fr: { selectCurrency: "Choisir la devise", selectLanguage: "Choisir la langue", help: "Aide", myCart: "Mon panier", cart: "Panier", signIn: "Se connecter", account: "Compte", signOut: "Se déconnecter", shopAll: "Tous les produits" },
    it: { selectCurrency: "Seleziona valuta", selectLanguage: "Seleziona lingua", help: "Aiuto", myCart: "Il mio carrello", cart: "Carrello", signIn: "Accedi", account: "Account", signOut: "Esci", shopAll: "Tutti i prodotti" },
    es: { selectCurrency: "Seleccionar moneda", selectLanguage: "Seleccionar idioma", help: "Ayuda", myCart: "Mi carrito", cart: "Carrito", signIn: "Iniciar sesión", account: "Cuenta", signOut: "Cerrar sesión", shopAll: "Todos los productos" },
    sl: { selectCurrency: "Izberi valuto", selectLanguage: "Izberi jezik", help: "Pomoč", myCart: "Moja košarica", cart: "Košarica", signIn: "Prijava", account: "Račun", signOut: "Odjava", shopAll: "Vsi izdelki" },
    nl: { selectCurrency: "Selecteer valuta", selectLanguage: "Selecteer taal", help: "Hulp", myCart: "Mijn winkelwagen", cart: "Winkelwagen", signIn: "Inloggen", account: "Account", signOut: "Uitloggen", shopAll: "Alle producten" },
    pl: { selectCurrency: "Wybierz walutę", selectLanguage: "Wybierz język", help: "Pomoc", myCart: "Mój koszyk", cart: "Koszyk", signIn: "Zaloguj się", account: "Konto", signOut: "Wyloguj się", shopAll: "Wszystkie produkty" },
    hr: { selectCurrency: "Izaberi valutu", selectLanguage: "Izaberi jezik", help: "Pomoć", myCart: "Moja košarica", cart: "Košarica", signIn: "Prijavi se", account: "Račun", signOut: "Odjavi se", shopAll: "Svi proizvodi" },
    cs: { selectCurrency: "Vybrat měnu", selectLanguage: "Vybrat jazyk", help: "Nápověda", myCart: "Můj košík", cart: "Košík", signIn: "Přihlásit se", account: "Účet", signOut: "Odhlásit se", shopAll: "Všechny produkty" },
    sk: { selectCurrency: "Vybrať menu", selectLanguage: "Vybrať jazyk", help: "Pomoc", myCart: "Môj košík", cart: "Košík", signIn: "Prihlásiť sa", account: "Účet", signOut: "Odhlásiť sa", shopAll: "Nakupovať všetko" },
    sv: { selectCurrency: "Välj valuta", selectLanguage: "Välj språk", help: "Hjälp", myCart: "Min varukorg", cart: "Varukorg", signIn: "Logga in", account: "Konto", signOut: "Logga ut", shopAll: "Handla alla" },
    da: { selectCurrency: "Vælg valuta", selectLanguage: "Vælg sprog", help: "Hjælp", myCart: "Min kurv", cart: "Kurv", signIn: "Log ind", account: "Konto", signOut: "Log ud", shopAll: "Se alle varer" },
    no: { selectCurrency: "Velg valuta", selectLanguage: "Velg språk", help: "Hjelp", myCart: "Min handlekurv", cart: "Handlekurv", signIn: "Logg inn", account: "Konto", signOut: "Logg ut", shopAll: "Handle alt" },
    ro: { selectCurrency: "Selectează moneda", selectLanguage: "Selectează limba", help: "Ajutor", myCart: "Coșul meu", cart: "Coș", signIn: "Autentificare", account: "Cont", signOut: "Deconectare", shopAll: "Toate" },
    bg: { selectCurrency: "Избери валута", selectLanguage: "Избери език", help: "Помощ", myCart: "Моята количка", cart: "Количка", signIn: "Вход", account: "Акаунт", signOut: "Изход", shopAll: "Всички продукти" },
    sr: { selectCurrency: "Izaberi valutu", selectLanguage: "Izaberi jezik", help: "Pomoć", myCart: "Moja korpa", cart: "Korpa", signIn: "Prijavi se", account: "Nalog", signOut: "Odjavi se", shopAll: "Sve iz ponude" },
    'sr-Cyrl': { selectCurrency: "Изабери валуту", selectLanguage: "Изабери језик", help: "Помоћ", myCart: "Моја корпа", cart: "Корпа", signIn: "Пријави се", account: "Налог", signOut: "Одјави се", shopAll: "Све из понуде" },
    mk: { selectCurrency: "Избери валута", selectLanguage: "Избери јазик", help: "Помош", myCart: "Моја кошничка", cart: "Кошничка", signIn: "Најави се", account: "Сметка", signOut: "Одјави се", shopAll: "Купи сè" },
    hu: { selectCurrency: "Pénznem kiválasztása", selectLanguage: "Nyelv kiválasztása", help: "Segítség", myCart: "Kosaram", cart: "Kosár", signIn: "Bejelentkezés", account: "Fiók", signOut: "Kijelentkezés", shopAll: "Összes termék" },
    pt: { selectCurrency: "Selecionar Moeda", selectLanguage: "Selecionar Idioma", help: "Ajuda", myCart: "O Meu Carrinho", cart: "Carrinho", signIn: "Entrar", account: "Conta", signOut: "Terminar Sessão", shopAll: "Ver Tudo" },
    lv: { selectCurrency: "Izvēlēties valūtu", selectLanguage: "Izvēlēties valodu", help: "Palīdzība", myCart: "Mans grozs", cart: "Grozs", signIn: "Pierakstīties", account: "Konts", signOut: "Izrakstīties", shopAll: "Visi produkti" },
    lt: { selectCurrency: "Pasirinkti valiutą", selectLanguage: "Pasirinkti kalbą", help: "Pagalba", myCart: "Mano krepšelis", cart: "Krepšelis", signIn: "Prisijungti", account: "Paskyra", signOut: "Atsijungti", shopAll: "Visi produktai" },
    et: { selectCurrency: "Vali valuuta", selectLanguage: "Vali keel", help: "Abi", myCart: "Minu ostukorv", cart: "Ostukorv", signIn: "Logi sisse", account: "Konto", signOut: "Logi välja", shopAll: "Kõik tooted" }
};

const footerTranslations = {
    en: { products: "Products", support: "Support", contactUs: "Contact Sales", shippingInfo: "Shipping Info", returnsWarranty: "Returns & Warranty", impressum: "Impressum", privacyPolicy: "Privacy Policy", termsOfService: "Terms of Service", allRightsReserved: "All rights reserved." },
    de: { products: "Produkte", support: "Support", contactUs: "Kontaktieren Sie uns", shippingInfo: "Versandinformationen", returnsWarranty: "Rückgabe & Garantie", impressum: "Impressum", privacyPolicy: "Datenschutzerklärung", termsOfService: "Allgemeine Geschäftsbedingungen", allRightsReserved: "Alle Rechte vorbehalten." },
    fr: { products: "Produits", support: "Support", contactUs: "Contactez-nous", shippingInfo: "Informations de livraison", returnsWarranty: "Retours & Garantie", impressum: "Mentions légales", privacyPolicy: "Politique de confidentialité", termsOfService: "Conditions générales", allRightsReserved: "Tous droits réservés." },
    it: { products: "Prodotti", support: "Assistenza", contactUs: "Contattaci", shippingInfo: "Informazioni sulla spedizione", returnsWarranty: "Resi & Garanzia", impressum: "Note legali", privacyPolicy: "Informativa sulla privacy", termsOfService: "Termini di servizio", allRightsReserved: "Tutti i diritti riservati." },
    es: { products: "Productos", support: "Soporte", contactUs: "Contáctenos", shippingInfo: "Información de envío", returnsWarranty: "Devoluciones y Garantía", impressum: "Aviso legal", privacyPolicy: "Política de privacidad", termsOfService: "Términos de servicio", allRightsReserved: "Todos los derechos reservados." },
    sl: { products: "Izdelki", support: "Podpora", contactUs: "Kontakt prodaja", shippingInfo: "Informacije o dostavi", returnsWarranty: "Vračila in garancija", impressum: "Impressum", privacyPolicy: "Politika zasebnosti", termsOfService: "Pogoji poslovanja", allRightsReserved: "Vse pravice pridržane." },
    nl: { products: "Producten", support: "Ondersteuning", contactUs: "Neem contact op", shippingInfo: "Verzendinformatie", returnsWarranty: "Retourneren & Garantie", impressum: "Impressum", privacyPolicy: "Privacybeleid", termsOfService: "Algemene Voorwaarden", allRightsReserved: "Alle rechten voorbehouden." },
    pl: { products: "Produkty", support: "Wsparcie", contactUs: "Skontaktuj się z nami", shippingInfo: "Informacje o wysyłce", returnsWarranty: "Zwroty i gwarancja", impressum: "Impressum", privacyPolicy: "Polityka prywatności", termsOfService: "Regulamin", allRightsReserved: "Wszelkie prawa zastrzeżone." },
    hr: { products: "Proizvodi", support: "Podrška", contactUs: "Kontaktirajte nas", shippingInfo: "Informacije o dostavi", returnsWarranty: "Povrat i jamstvo", impressum: "Impressum", privacyPolicy: "Politika privatnosti", termsOfService: "Uvjeti pružanja usluge", allRightsReserved: "Sva prava pridržana." },
    cs: { products: "Produkty", support: "Podpora", contactUs: "Kontaktujte nás", shippingInfo: "Informace o dopravě", returnsWarranty: "Vrácení a záruka", impressum: "Impressum", privacyPolicy: "Zásady ochrany osobních údajů", termsOfService: "Obchodní podmínky", allRightsReserved: "Všechna práva vyhrazena." },
    sk: { products: "Produkty", support: "Podpora", contactUs: "Kontaktujte nás", shippingInfo: "Informácie o doprave", returnsWarranty: "Vrátenie a záruka", impressum: "Impressum", privacyPolicy: "Zásady ochrany osobných údajov", termsOfService: "Obchodné podmienky", allRightsReserved: "Všetky práva vyhradené." },
    sv: { products: "Produkter", support: "Support", contactUs: "Kontakta oss", shippingInfo: "Fraktinformation", returnsWarranty: "Retur & Garanti", impressum: "Impressum", privacyPolicy: "Integritetspolicy", termsOfService: "Användarvillkor", allRightsReserved: "Alla rättigheter förbehållna." },
    da: { products: "Produkter", support: "Support", contactUs: "Kontakt os", shippingInfo: "Forsendelsesinfo", returnsWarranty: "Retur & Garanti", impressum: "Impressum", privacyPolicy: "Privatlivspolitik", termsOfService: "Servicevilkår", allRightsReserved: "Alle rettigheder forbeholdes." },
    no: { products: "Produkter", support: "Brukerstøtte", contactUs: "Kontakt oss", shippingInfo: "Fraktinformasjon", returnsWarranty: "Retur og garanti", impressum: "Impressum", privacyPolicy: "Personvernserklæring", termsOfService: "Vilkår for bruk", allRightsReserved: "Alle rettigheter forbeholdt." },
    ro: { products: "Produse", support: "Suport", contactUs: "Contactați-ne", shippingInfo: "Informații livrare", returnsWarranty: "Returnări și garanție", impressum: "Impressum", privacyPolicy: "Politica de confidențialitate", termsOfService: "Termeni și condiții", allRightsReserved: "Toate drepturile rezervate." },
    bg: { products: "Продукти", support: "Поддръжка", contactUs: "Свържете се с нас", shippingInfo: "Информация за доставка", returnsWarranty: "Връщания и гаранция", impressum: "Impressum", privacyPolicy: "Политика за поверителност", termsOfService: "Общи условия", allRightsReserved: "Всички права запазени." },
    sr: { products: "Proizvodi", support: "Podrška", contactUs: "Kontaktirajte nas", shippingInfo: "Informacije o isporuci", returnsWarranty: "Povraćaj i garancija", impressum: "Impressum", privacyPolicy: "Politika privatnosti", termsOfService: "Uslovi korišćenja", allRightsReserved: "Sva prava zadržana." },
    'sr-Cyrl': { products: "Производи", support: "Подршка", contactUs: "Контактирајте нас", shippingInfo: "Информације о испоруци", returnsWarranty: "Повраћај и гаранција", impressum: "Impressum", privacyPolicy: "Политика приватности", termsOfService: "Услови коришћења", allRightsReserved: "Сва права задржана." },
    mk: { products: "Производи", support: "Поддршка", contactUs: "Контактирајте нè", shippingInfo: "Информации за испорака", returnsWarranty: "Враќање и гаранција", impressum: "Impressum", privacyPolicy: "Политика на приватност", termsOfService: "Услови за користење", allRightsReserved: "Сите права задржани." },
    hu: { products: "Termékek", support: "Támogatás", contactUs: "Lépjen kapcsolatba velünk", shippingInfo: "Szállítási információk", returnsWarranty: "Visszaküldés és garancia", impressum: "Impressum", privacyPolicy: "Adatvédelmi szabályzat", termsOfService: "Általános szerződési feltételek", allRightsReserved: "Minden jog fenntartva." },
    pt: { products: "Produtos", support: "Suporte", contactUs: "Contacte-nos", shippingInfo: "Informações de Envio", returnsWarranty: "Devoluções e Garantia", impressum: "Impressum", privacyPolicy: "Política de Privacidade", termsOfService: "Termos de Serviço", allRightsReserved: "Todos os direitos reservados." },
    lv: { products: "Produkti", support: "Atbalsts", contactUs: "Sazinieties ar mums", shippingInfo: "Piegādes informācija", returnsWarranty: "Atgriešana un garantija", impressum: "Impressum", privacyPolicy: "Privātuma politika", termsOfService: "Pakalpojumu noteikumi", allRightsReserved: "Visas tiesības aizsargātas." },
    lt: { products: "Produktai", support: "Pagalba", contactUs: "Susisiekite su mumis", shippingInfo: "Pristatymo informacija", returnsWarranty: "Grąžinimai ir garantija", impressum: "Impressum", privacyPolicy: "Privatumo politika", termsOfService: "Paslaugų teikimo sąlygos", allRightsReserved: "Visos teisės saugomos." },
    et: { products: "Tooted", support: "Tugi", contactUs: "Võta meiega ühendust", shippingInfo: "Tarne info", returnsWarranty: "Tagastused ja garantii", impressum: "Impressum", privacyPolicy: "Privaatsuspoliitika", termsOfService: "Kasutustingimused", allRightsReserved: "Kõik õigused kaitstud." }
};

const homeTranslations = {
    en: { heroTitle: "Specialized Online Store For Tigo Energy Products", heroSubtitle: "No markups. No surprises. Just direct access.", shopNow: "Shop Now", globalReach: "Global Reach, Local Focus" },
    de: { heroTitle: "Spezialisierter Online-Shop für Tigo Energy Produkte", heroSubtitle: "Keine Aufschläge. Keine Überraschungen. Nur direkter Zugang.", shopNow: "Jetzt einkaufen", globalReach: "Globale Reichweite, lokaler Fokus" },
    fr: { heroTitle: "Boutique en ligne spécialisée pour les produits Tigo Energy", heroSubtitle: "Pas de majoration. Pas de surprise. Juste un accès direct.", shopNow: "Acheter maintenant", globalReach: "Portée mondiale, orientation locale" },
    it: { heroTitle: "Negozio online specializzato per prodotti Tigo Energy", heroSubtitle: "Nessun rincaro. Nessuna sorpresa. Solo accesso diretto.", shopNow: "Acquista ora", globalReach: "Portata globale, focus locale" },
    es: { heroTitle: "Tienda online especializada para productos Tigo Energy", heroSubtitle: "Sin recargos. Sin sorpresas. Solo acceso directo.", shopNow: "Comprar ahora", globalReach: "Alcance global, enfoque local" },
    sl: { heroTitle: "Specializirana spletna trgovina za Tigo Energy izdelke", heroSubtitle: "Brez pribitkov. Brez presenečenj. Samo neposreden dostop.", shopNow: "Kupite zdaj", globalReach: "Globalni doseg, lokalni fokus" },
    nl: { heroTitle: "Gespecialiseerde online winkel voor Tigo Energy producten", heroSubtitle: "Geen toeslagen. Geen verrassingen. Alleen directe toegang.", shopNow: "Nu winkelen", globalReach: "Wereldwijd bereik, lokale focus" },
    pl: { heroTitle: "Specjalistyczny sklep internetowy z produktami Tigo Energy", heroSubtitle: "Bez narzutów. Bez niespodzianek. Tylko bezpośredni dostęp.", shopNow: "Kup teraz", globalReach: "Zasięg globalny, koncentracja lokalna" },
    hr: { heroTitle: "Specijalizirana online trgovina za Tigo Energy proizvode", heroSubtitle: "Bez dodataka. Bez iznenađenja. Samo izravan pristup.", shopNow: "Kupite sada", globalReach: "Globalni doseg, lokalni fokus" },
    cs: { heroTitle: "Specializovaný online obchod s produkty Tigo Energy", heroSubtitle: "Žádné přirážky. Žádná překvapení. Jen přímý přístup.", shopNow: "Nakupovat nyní", globalReach: "Globální dosah, lokální zaměření" },
    sk: { heroTitle: "Špecializovaný internetový obchod pre produkty Tigo Energy", heroSubtitle: "Žiadne prirážky, žiadne prekvapenia, len priamy prístup", shopNow: "Nakupovať teraz", globalReach: "Globálny dosah, lokálne zameranie" },
    sv: { heroTitle: "Specialiserad onlinebutik för Tigo Energy-produkter", heroSubtitle: "Inga påslag, inga överraskningar, bara direkt åtkomst", shopNow: "Handla nu", globalReach: "Global räckvidd, lokalt fokus" },
    da: { heroTitle: "Specialiseret onlinebutik for Tigo Energy-produkter", heroSubtitle: "Ingen påslag, ingen overraskelser, kun direkte adgang", shopNow: "Køb nu", globalReach: "Global rækkevidde, lokalt fokus" },
    no: { heroTitle: "Spesialisert nettbutikk for Tigo Energy-produkter", heroSubtitle: "Ingen påslag, ingen overraskelser, bare direkte tilgang", shopNow: "Handle nå", globalReach: "Global rekkevidde, lokalt fokus" },
    ro: { heroTitle: "Magazin online specializat pentru produse Tigo Energy", heroSubtitle: "Fără adaosuri. Fără surprize. Doar acces direct.", shopNow: "Cumpără acum", globalReach: "Acoperire globală, focus local" },
    bg: { heroTitle: "Специализиран онлайн магазин за продукти на Tigo Energy", heroSubtitle: "Без надценки. Без изненади. Само директен достъп.", shopNow: "Купете сега", globalReach: "Глобален обхват, локален фокус" },
    sr: { heroTitle: "Specijalizovana online prodavnica za Tigo Energy proizvode", heroSubtitle: "Bez dodataka. Bez iznenađenja. Samo direktan pristup.", shopNow: "Kupite sada", globalReach: "Globalni domet, lokalni fokus" },
    'sr-Cyrl': { heroTitle: "Специјализована онлине продавница за Tigo Energy производе", heroSubtitle: "Без додатака. Без изненађења. Само директан приступ.", shopNow: "Купите сада", globalReach: "Глобални домет, локални фокус" },
    mk: { heroTitle: "Специјализирана онлајн продавница за производи на Tigo Energy", heroSubtitle: "Без маржи. Без изненадувања. Само директен пристап.", shopNow: "Купи сега", globalReach: "Глобален дофат, локален фокус" },
    hu: { heroTitle: "Specializált online áruház Tigo Energy termékekhez", heroSubtitle: "Nincs felár. Nincs meglepetés. Csak közvetlen hozzáférés.", shopNow: "Vásárlás most", globalReach: "Globális elérés, helyi fókusz" },
    pt: { heroTitle: "Loja Online Especializada em Produtos Tigo Energy", heroSubtitle: "Sem margens. Sem surpresas. Apenas acesso direto.", shopNow: "Comprar Agora", globalReach: "Alcance Global, Foco Local" },
    lv: { heroTitle: "Specializēts tiešsaistes veikals Tigo Energy produktiem", heroSubtitle: "Bez uzcenojuma. Bez pārsteigumiem. Tikai tieša piekļuve.", shopNow: "Pirkt tagad", globalReach: "Globāla sasniedzamība, vietējais fokuss" },
    lt: { heroTitle: "Specializuota internetinė parduotuvė Tigo Energy produktams", heroSubtitle: "Jokių antkainių. Jokių siurprizų. Tik tiesioginė prieiga.", shopNow: "Pirkti dabar", globalReach: "Globalus pasiekiamumas, vietinis dėmesys" },
    et: { heroTitle: "Spetsialiseeritud veebipood Tigo Energy toodetele", heroSubtitle: "Lisasid pole. Üllatusi pole. Ainult otsene juurdepääs.", shopNow: "Osta kohe", globalReach: "Globaalne haare, kohalik fookus" }
};

/**
 * Updates a JSON translation file with new namespace data.
 */
function updateJson(filePath, namespaces) {
    if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        return;
    }
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    for (const [key, data] of Object.entries(namespaces)) {
        if (!data) continue;
        content[key] = { ...(content[key] || {}), ...data };
    }

    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
    console.log(`Updated ${filePath}`);
}

const basePath = process.argv[2] || '.';

SUPPORTED_LOCALES.forEach(locale => {
    const filePath = path.join(basePath, `src/messages/${locale}.json`);
    const namespaces = {};

    if (commonTranslations[locale]) namespaces.common = commonTranslations[locale];
    if (headerTranslations[locale]) namespaces.header = headerTranslations[locale];
    if (footerTranslations[locale]) namespaces.footer = footerTranslations[locale];
    if (homeTranslations[locale]) namespaces.home = homeTranslations[locale];

    // Maintain existing staticPages/auth/email for major languages if already present in original script
    // Note: The logic above is streamlined for the 24-locale synchronization.

    if (Object.keys(namespaces).length > 0) {
        updateJson(filePath, namespaces);
    }
});


