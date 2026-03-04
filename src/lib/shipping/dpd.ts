
export interface DPDShipmentRequest {
    name1: string;
    name2?: string;
    contact?: string;
    street: string;
    rPropNum: string;
    city: string;
    country: string; // ISO2
    pcode: string;
    email: string;
    phone: string;
    weight: number;
    num_of_parcel: number;
    order_number: string;
    parcel_type: string; // D, D-B2C, etc.
    predict?: number; // 1 for active
}

export interface DPDShipmentResponse {
    status: 'ok' | 'err';
    errlog: string | null;
    pl_number?: string[];
}

export interface OrderItem {
    sku: string;
    name: string;
    quantity: number;
    weight_kg: number;
}

export interface Parcel {
    weight: number;
}

/**
 * Splits a street string into street name and house number for DPD
 */
export function splitStreetAndNumber(address: string) {
    if (!address) return { street: '', number: '' };
    const match = address.trim().match(/^(.*?)\s+((?:\d+[a-zA-Z/]*)|(?:\d+.*))$/);
    if (match) {
        return { street: match[1].trim(), number: match[2].trim() };
    }
    return { street: address.trim(), number: '' };
}

/**
 * Tigo-specific packaging logic:
 * - A-Series (A-O, A-F, A-2F): 20 units/box. (A-2F is heavier but same volume).
 * - X-Series (X-): 18 units/box. 
 * - Scootable Items (CCA, RSS): Small items that can fit into partial MLPE boxes.
 * - Large Items (Inverters, BMS, Batteries): Always ship as individual boxes.
 */
export function calculateTigoParcels(items: OrderItem[]): Parcel[] {
    const mlpe20_leftovers: { weight: number, qty: number }[] = [];
    const mlpe18_leftovers: { weight: number, qty: number }[] = [];
    const scootable_items: { weight: number, qty: number }[] = [];
    const parcels: Parcel[] = [];
    let otherWeight = 0;

    items.forEach(item => {
        const name = item.name.toUpperCase();
        const sku = item.sku.toUpperCase();
        const weight = Number(item.weight_kg);

        // Classify items
        const isAseries = name.includes('TS4-A-O') || name.includes('TS4-A-F') || name.includes('TS4-A-2F');
        const isXseries = name.startsWith('TS4-X');
        const isScootable = name.includes('CCA') || name.includes('RSS') || name.includes('TAP');
        const isLarge = name.includes('INVERTER') || name.includes('BMS') || name.includes('BATTERY') || name.includes('EI LINK');

        if (isAseries) {
            let left = item.quantity;
            while (left >= 20) {
                parcels.push({ weight: (20 * weight) + 0.5 });
                left -= 20;
            }
            if (left > 0) mlpe20_leftovers.push({ weight, qty: left });
        } else if (isXseries) {
            let left = item.quantity;
            while (left >= 18) {
                parcels.push({ weight: (18 * weight) + 0.5 });
                left -= 18;
            }
            if (left > 0) mlpe18_leftovers.push({ weight, qty: left });
        } else if (isLarge) {
            // Large items are individual parcels (1 per item)
            for (let i = 0; i < item.quantity; i++) {
                parcels.push({ weight: weight + 1.0 }); // heavier packaging for large items
            }
        } else if (isScootable) {
            scootable_items.push({ weight, qty: item.quantity });
        } else {
            otherWeight += weight * item.quantity;
        }
    });

    // Handle partial boxes and scooting
    // We'll use a "Virtual Box" system (Capacity: 20 units of volume)
    // A-series = 1.0 vol units, X-series = 1.1 vol units, Scootables = 4.0 vol units

    let currentBoxVolume = 0;
    let currentBoxWeight = 0;

    const pack = (vol: number, wt: number) => {
        if (currentBoxVolume + vol <= 20) {
            currentBoxVolume += vol;
            currentBoxWeight += wt;
            return true;
        }
        return false;
    };

    const shipCurrentBox = () => {
        if (currentBoxWeight > 0) {
            parcels.push({ weight: Math.round((currentBoxWeight + 0.5) * 100) / 100 });
            currentBoxWeight = 0;
            currentBoxVolume = 0;
        }
    };

    // Pack leftovers in priority: 20-series -> 18-series -> Scootables
    mlpe20_leftovers.forEach(item => {
        for (let i = 0; i < item.qty; i++) {
            if (!pack(1.0, item.weight)) {
                shipCurrentBox();
                pack(1.0, item.weight);
            }
        }
    });

    mlpe18_leftovers.forEach(item => {
        for (let i = 0; i < item.qty; i++) {
            if (!pack(1.1, item.weight)) {
                shipCurrentBox();
                pack(1.1, item.weight);
            }
        }
    });

    scootable_items.forEach(item => {
        for (let i = 0; i < item.qty; i++) {
            if (!pack(4.0, item.weight)) {
                shipCurrentBox();
                pack(4.0, item.weight);
            }
        }
    });

    shipCurrentBox();

    // Final catch-all for remaining "other" weight
    if (otherWeight > 0) {
        while (otherWeight > 25) { // DPD weight limit for comfortable lifting
            parcels.push({ weight: 26.0 });
            otherWeight -= 25;
        }
        parcels.push({ weight: Math.round((otherWeight + 0.5) * 100) / 100 });
    }

    return parcels.length > 0 ? parcels : [{ weight: 1.0 }];
}

export class DPDService {
    private baseUrl: string;
    private authHeader: string;

    constructor() {
        this.baseUrl = 'https://easyship.si/api/parcel';

        // Use provided credentials or env
        const username = process.env.DPD_USERNAME || 'initraenergijadoo';
        const password = process.env.DPD_PASSWORD || 'Adria@12345';
        this.authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    }

    /**
     * Create a shipment in DPD EasyShip
     */
    async createShipment(data: DPDShipmentRequest, weights?: number[]): Promise<DPDShipmentResponse> {
        const url = new URL(`${this.baseUrl}/import`);

        // Handle multiple parcels
        const requestData: any = { ...data };
        if (weights && weights.length > 0) {
            requestData.num_of_parcel = weights.length;
            // Delete the single weight if it exists
            delete requestData.weight;
        }

        // DPD API takes parameters as query string even in POST
        Object.entries(requestData).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, value.toString());
            }
        });

        // Add multiple weights if provided: &weight=10.5&weight=12.0
        if (weights && weights.length > 0) {
            weights.forEach(w => url.searchParams.append('weight', w.toFixed(2)));
        }

        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Authorization': this.authHeader,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`DPD API error (${response.status}): ${text}`);
        }

        return await response.json();
    }

    /**
     * Get label PDF for specified parcel numbers
     */
    async getLabels(parcelNumbers: string[], format: 'PDF_A4' | 'PDF_A6' | 'ZPL' = 'PDF_A6'): Promise<Buffer> {
        const url = new URL(`${this.baseUrl}/print`);
        url.searchParams.append('parcels', parcelNumbers.join(','));
        url.searchParams.append('format', format);

        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Authorization': this.authHeader
            }
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`DPD Label error (${response.status}): ${text}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }
}
