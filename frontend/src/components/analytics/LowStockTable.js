import React from "react";
import {
  Card,
  Text,
  Badge,
  DataTable,
  BlockStack,
  Box,
  InlineStack,
} from "@shopify/polaris";

const LowStockTable = ({ products, formatPrice }) => {
  if (!products || products.length === 0) return null;

  return (
    <Card>
      <Box padding="400">
        <BlockStack gap="400">
          <InlineStack align="space-between">
            <Text variant="headingMd" as="h3">Low Stock Products</Text>
            <Badge tone="warning">{products.length} products</Badge>
          </InlineStack>

          <div style={{ overflowX: "auto" }}>
            <DataTable
              columnContentTypes={["text", "text", "numeric", "numeric"]}
              headings={["Product", "Category", "Stock", "Price"]}
              rows={products.slice(0, 5).map((product) => [
                product.name,
                product.category,
                <Badge tone={product.stock < 5 ? "critical" : "warning"} key={product.id}>
                  {product.stock} units
                </Badge>,
                formatPrice(product.price),
              ])}
            />
          </div>
        </BlockStack>
      </Box>
    </Card>
  );
};

export default LowStockTable;
