import React from "react";
import {
  Card,
  Text,
  DataTable,
  BlockStack,
  Box,
  InlineStack,
  Button,
} from "@shopify/polaris";
import { ArrowDownIcon } from "@shopify/polaris-icons";

const TopProductsTable = ({ products, formatPrice, onExport }) => {
  // Preparar las filas
  const rows = products && products.length > 0 
    ? products.slice(0, 5).map((p) => [
        p.name || "Unknown Product",
        p.units_sold || 0,
        formatPrice(p.revenue || 0),
      ])
    : [];

  return (
    <Card>
      <Box padding="400">
        <BlockStack gap="400">
          <InlineStack align="space-between">
            <Text variant="headingMd" as="h3">
              Top Products
            </Text>
            {onExport && (
              <Button
                plain
                icon={ArrowDownIcon}
                onClick={() => onExport("products")}
                size="slim"
              >
                Export
              </Button>
            )}
          </InlineStack>

          {rows.length > 0 ? (
            <div style={{ 
              overflowX: "auto",
              overflowY: "hidden",
              maxWidth: "100%",
              WebkitOverflowScrolling: "touch",
              marginTop: "16px"
            }}>
              <div style={{ minWidth: "400px" }}>
                <DataTable
                  columnContentTypes={["text", "numeric", "numeric"]}
                  headings={["Product", "Units", "Revenue"]}
                  rows={rows}
                  truncate={true}
                />
              </div>
            </div>
          ) : (
            <Box padding="800">
              <Text variant="bodySm" tone="subdued" alignment="center">
                No sales data available yet
              </Text>
            </Box>
          )}
        </BlockStack>
      </Box>
    </Card>
  );
};

export default TopProductsTable;