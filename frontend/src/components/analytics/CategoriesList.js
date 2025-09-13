import React from "react";
import {
  Card,
  Text,
  Badge,
  BlockStack,
  Box,
  InlineStack,
} from "@shopify/polaris";

const CategoriesList = ({ categories, formatPrice }) => (
  <Card>
    <Box padding="400">
      <BlockStack gap="400">
        <Text variant="headingMd" as="h3">Categories</Text>

        {categories && categories.length > 0 ? (
          <BlockStack gap="200">
            {categories.slice(0, 5).map((cat, index) => (
              <div key={index}>
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="bodyMd">{cat.category}</Text>
                  <InlineStack gap="200">
                    <Badge>{cat.percentage}%</Badge>
                    <Text variant="bodyMd" tone="subdued">
                      {formatPrice(cat.revenue)}
                    </Text>
                  </InlineStack>
                </InlineStack>

                {/* Progress bar */}
                <div
                  style={{
                    width: "100%",
                    height: "8px",
                    backgroundColor: "#f1f2f4",
                    borderRadius: "4px",
                    marginTop: "8px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${cat.percentage}%`,
                      height: "100%",
                      backgroundColor: "#5c6ac4",
                      borderRadius: "4px",
                    }}
                  />
                </div>
              </div>
            ))}
          </BlockStack>
        ) : (
          <Text variant="bodySm" tone="subdued" alignment="center">
            No category data available
          </Text>
        )}
      </BlockStack>
    </Box>
  </Card>
);

export default CategoriesList;
