# Ecommerce Module Roadmap

This project is evolving into a merchant-grade ecommerce and cloud-pet platform.
The base MVP already includes catalog, cart, order, payment, member, cloud-pet,
community, admin, shipment, and a member coupon path. The modules below must
still be completed so future work does not lose track of the delivery scope.

## Modules To Complete

1. Marketing center: coupon admin, campaign configuration, threshold discounts,
   limited-time offers, and member-only pricing.
   Status: foundation implemented with admin coupon status and checkout enforcement.
2. Points and tier system: points earning, redemption, tier growth value, and
   automatic benefit issuance.
   Status: foundation implemented with member tier summary, points ledger,
   checkout coupon redemption, available point deduction, and member-center
   redemption actions. Redeemed points coupons are now bound to the issuing
   member and locked after first checkout use.
3. After-sales and refunds: refund requests, return workflows, after-sales
   statuses, and payment refund records.
   Status: foundation implemented with refund request review, partial refund
   balance controls, over-refund prevention, final-refund status transitions,
   and stock release on full approval.
4. Review system: product reviews, image reviews, follow-up reviews, and admin
   moderation.
   Status: foundation implemented with completed-order review submission, storefront review list, and admin moderation.
5. Product admin CRUD: create products, image management, categories, tags, and
   bulk publish/archive operations.
   Status: foundation implemented with create product, publish/archive, stock
   update, and public storefront search/filter/sort discovery.
6. Inventory center: stock reservation, payment stock deduction, cancellation
   release, and low-stock warnings.
   Status: foundation implemented with order stock reservation, cancellation/refund release, and low-stock alerts.
7. Logistics tracking: shipment events, signed status, delivery exceptions, and
   customer-facing tracking detail.
   Status: foundation implemented with shipment events, delivered completion, exceptions, and tracking API.
8. Notification center: order, shipment, growth task, community, and coupon
   expiry reminders.
   Status: foundation implemented with member notifications for coupons, growth tasks, orders, delivery, review requests, and review status.
9. Community engagement: likes, comments, follows, reports, and topics.
   Status: foundation implemented with likes, comments, pet follows, reports, admin report handling, and member engagement metrics.
10. Cloud-pet growth system: streak tasks, growth levels, state decay, and
    reward links into commerce.
    Status: foundation implemented with growth levels, experience points,
    progress, daily task activity, care score/state, and pet/member UI visibility.
    Commerce reward links now unlock WELCOME20 and pet-matched shop CTAs from
    the dedicated homepage after daily growth activity.
11. Pet homepage builder: page decoration, share pages, growth archives, and
    owner stories.
    Status: foundation implemented with persisted homepage theme, headline,
    owner story, growth archive visibility, mall recommendation visibility,
    public rendering, cloud-pet studio editing, share metadata, and filterable
    growth archive API/page rendering, including reward cards tied to growth
    completion and homepage visit signals flowing back to archive/admin metrics.
12. Recommendation system: recommendations based on pet profile, orders, tasks,
    and community behavior.
    Status: foundation implemented with member personalization profile, scored
    product/task/content recommendations, CMS campaign signals, homepage share
    heat weighting, and member-center UI.
13. Merchant analytics: GMV, conversion, repeat purchase, retention, and product
    sales rankings.
    Status: foundation implemented with admin analytics API, GMV/AOV, paid order
    rate, repeat customer rate, product rankings, homepage visit retention
    signals, customer segments with next-best merchant actions, conversion
    funnel/drop-off stages, CRM customer profiles with tags/notes/follow-ups,
    and retention signals.
14. Customer account and address book: member identity, reusable shipping
    addresses, default address, and CRM customer data.
    Status: foundation implemented with member login/session, member profile
    lookup, CRM customer profiles, and member default address creation/visibility.
15. Staff permissions: admin roles, scoped permissions, and operation logs.
    Status: foundation implemented with owner/operator staff profiles, scoped write permissions, operation log persistence, and admin audit log UI.
16. CMS automation: configurable diary, homepage modules, campaign pages, and
    pet story publishing flows.
    Status: foundation implemented with CMS block persistence, public slot API, admin create/publish/archive controls, homepage rendering, and audit logs.

## Development Order

1. Marketing center and coupons.
2. Points and member tiers.
3. After-sales and refunds.
4. Inventory and logistics hardening.
5. Reviews, community engagement, and notifications.
6. Analytics, permissions, CMS, and advanced personalization.

## Current Sprint

Finish retention-facing operations foundations. Inventory, logistics, reviews,
notifications, community engagement, merchant analytics, and cloud-pet growth
levels are now covered at API, admin, storefront/cloud-pet, and member-center
levels; the next highest-impact work is pet homepage builder depth, reward
automation, storefront discovery depth, and enterprise hardening.
