import { RequestItem, Snapshot, Supplier } from './domain';
export function createSeed(): Snapshot {
  const ago = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
  const suppliers: Supplier[] = [
    {
      id: 1,
      name: 'Evergreen Packaging',
      category: 'Packaging',
      location: 'Portland, OR',
      rating: 4.9,
      completedOrders: 48,
    },
    {
      id: 2,
      name: 'Northstar Supply',
      category: 'Equipment',
      location: 'Austin, TX',
      rating: 4.8,
      completedOrders: 32,
    },
    {
      id: 3,
      name: 'Field & Flour',
      category: 'Ingredients',
      location: 'Denver, CO',
      rating: 4.7,
      completedOrders: 61,
    },
    {
      id: 4,
      name: 'Meridian Freight',
      category: 'Logistics',
      location: 'Seattle, WA',
      rating: 4.9,
      completedOrders: 84,
    },
  ];
  const make = (
    id: number,
    title: string,
    category: string,
    budgetCents: number,
    quantity: number,
    unit: string,
    status: RequestItem['status'],
    description: string,
  ): RequestItem => ({
    id,
    reference: `RFQ-${new Date().getFullYear()}-${1040 + id}`,
    title,
    category,
    budgetCents,
    quantity,
    unit,
    status,
    description,
    quoteCount: 0,
    createdAtUtc: ago(id + 2),
    updatedAtUtc: ago(id === 3 ? 0 : id - 1),
    version: 1,
    awardedQuoteId: null,
    quotes: [],
  });
  const requests = [
    make(
      1,
      'Compostable takeaway containers',
      'Packaging',
      450000,
      5000,
      'units',
      'Open',
      'Food-safe, compostable takeaway containers with secure lids. Include material specifications and samples.',
    ),
    make(
      2,
      'Commercial espresso machines',
      'Equipment',
      1280000,
      4,
      'units',
      'Open',
      'Two-group espresso machines for four fictional cafe locations. Include installation and warranty details.',
    ),
    make(
      3,
      'Organic flour for spring menu',
      'Ingredients',
      320000,
      800,
      'kg',
      'Awarded',
      'Certified organic bread flour, delivered in food-safe bags to our fictional central kitchen.',
    ),
    make(
      4,
      'Regional refrigerated deliveries',
      'Logistics',
      680000,
      24,
      'shipments',
      'Draft',
      'Temperature-controlled deliveries between fictional regional cafe locations. Provide route and timing options.',
    ),
    make(
      5,
      'Branded recycled paper bags',
      'Packaging',
      240000,
      3000,
      'units',
      'Open',
      'Recycled paper bags with one-color branding. Quote should cover setup, proofing and delivery.',
    ),
    make(
      6,
      'Kitchen prep station sets',
      'Equipment',
      840000,
      6,
      'sets',
      'Draft',
      'Stainless steel prep stations for a fictional kitchen. Include dimensions, load ratings and lead time.',
    ),
  ];
  const quote = (
    id: number,
    requestId: number,
    supplierId: number,
    amountCents: number,
    leadTimeDays: number,
    note: string,
  ) => {
    const s = suppliers.find((x) => x.id === supplierId)!;
    requests
      .find((r) => r.id === requestId)!
      .quotes.push({
        id,
        supplierId,
        supplierName: s.name,
        supplierRating: s.rating,
        amountCents,
        leadTimeDays,
        note,
        createdAtUtc: ago(1),
      });
  };
  quote(1, 1, 1, 398000, 7, 'Certified compostable material. Samples and delivery included.');
  quote(2, 1, 2, 425000, 5, 'Priority delivery and a sample pack included.');
  quote(3, 2, 2, 1195000, 14, 'Installation, training and a 12-month warranty included.');
  quote(4, 3, 3, 288000, 4, 'Organic certification and batch traceability supplied.');
  quote(5, 5, 1, 218000, 10, 'Recycled stock, print proof and delivery included.');
  requests.forEach((r) => (r.quoteCount = r.quotes.length));
  requests[2].awardedQuoteId = 4;
  return {
    schema: 1,
    requests,
    suppliers,
    activity: [
      {
        id: 3,
        requestId: 3,
        action: 'Request awarded',
        actor: 'Demo buyer',
        detail: 'Selected Field & Flour for organic flour.',
        createdAtUtc: ago(0),
      },
      {
        id: 2,
        requestId: 1,
        action: 'Quote received',
        actor: 'Evergreen Packaging',
        detail: 'New quote for compostable takeaway containers.',
        createdAtUtc: ago(1),
      },
      {
        id: 1,
        requestId: 4,
        action: 'Request created',
        actor: 'Demo buyer',
        detail: 'Regional refrigerated deliveries saved as a draft.',
        createdAtUtc: ago(2),
      },
    ],
  };
}
