export default function AffiliateDisclosurePage() {
  return (
    <main className="min-h-screen bg-[#fffafc] px-6 py-16">
      <article className="mx-auto max-w-4xl text-[#201b28]">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-[#8f6e99]">
          SkinDecode
        </p>

        <h1 className="mb-4 font-['Instrument_Serif'] text-5xl">
          Affiliate Disclosure
        </h1>

        <p className="mb-12 text-sm text-[#746b78]">
          Last updated: September 9, 2026
          <br />
          Version: 1.0
        </p>

        <section className="space-y-8 text-[15px] leading-7">
          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Our Affiliate Relationships
            </h2>

            <p>
              Some links on SkinDecode may be affiliate links.
              If you purchase a product after clicking one of
              these links, SkinDecode may receive a commission
              from the retailer or affiliate partner.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Does This Affect Recommendations?
            </h2>

            <p>
              Affiliate relationships may be one factor in the
              commercial presentation of products, but a product
              being an affiliate product does not by itself mean
              that SkinDecode considers it suitable for every
              user.
            </p>

            <p className="mt-3">
              Recommendations may consider product information,
              ingredients, compatibility scoring, user-provided
              preferences, product availability, price, and
              other factors used by SkinDecode's recommendation
              system.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Prices and Availability
            </h2>

            <p>
              Prices, discounts, stock, and availability can
              change. Always verify the final price and product
              information on the retailer's website before
              purchasing.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-semibold">
              Your Cost
            </h2>

            <p>
              An affiliate commission generally does not increase
              the price you pay for the product, although the
              final terms are determined by the retailer.
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}