import { PrismaClient } from "@prisma/client";
import { starterProducts } from "../src/products/products.seed";

const prisma = new PrismaClient();

async function main() {
  for (const product of starterProducts) {
    const savedProduct = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        title: product.title,
        description: product.description,
        petType: product.petType,
        toyType: product.toyType,
        status: product.status
      },
      create: {
        id: product.id,
        slug: product.slug,
        title: product.title,
        description: product.description,
        petType: product.petType,
        toyType: product.toyType,
        status: product.status
      }
    });

    await prisma.productImage.deleteMany({
      where: { productId: savedProduct.id }
    });
    await prisma.productImage.createMany({
      data: product.images.map((url, index) => ({
        productId: savedProduct.id,
        url,
        sortOrder: index
      }))
    });

    for (const variant of product.variants) {
      await prisma.productVariant.upsert({
        where: { skuCode: variant.skuCode },
        update: {
          productId: savedProduct.id,
          name: variant.name,
          color: variant.color,
          size: variant.size,
          material: variant.material,
          priceCents: variant.priceCents,
          compareAtCents: variant.compareAtCents ?? null,
          stock: variant.stock
        },
        create: {
          id: variant.id,
          productId: savedProduct.id,
          skuCode: variant.skuCode,
          name: variant.name,
          color: variant.color,
          size: variant.size,
          material: variant.material,
          priceCents: variant.priceCents,
          compareAtCents: variant.compareAtCents ?? null,
          stock: variant.stock
        }
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
