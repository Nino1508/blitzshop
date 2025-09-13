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

const TopCustomersTable = ({ customers, formatPrice, onExport }) => (
  <Card>
    <Box padding="400">
      <BlockStack gap="400">
        <InlineStack align="space-between">
          <Text variant="headingMd" as="h3">Top Customers</Text>
          <Button
            plain
            icon={ArrowDownIcon}
            onClick={() => onExport("customers")}
          >
            Export
          </Button>
        </InlineStack>

        {customers && customers.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <DataTable
              columnContentTypes={["text", "text", "numeric", "numeric"]}
              headings={["Customer", "Email", "Orders", "Total Spent"]}
              rows={customers.map((c, index) => [
                c.username,
                c.email,
                c.total_orders,
                formatPrice(c.total_spent),
              ])}
            />
          </div>
        ) : (
          <Text variant="bodySm" tone="subdued" alignment="center">
            No customer data available yet
          </Text>
        )}
      </BlockStack>
    </Box>
  </Card>
);

export default TopCustomersTable;
