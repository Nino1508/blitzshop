import React from "react";
import { Card, Text, BlockStack } from "@shopify/polaris";

const MetricCard = ({ title, value, subtitle }) => {
  return (
    <Card>
      <BlockStack gap="200">
        <Text variant="headingMd" as="h2">
          {title}
        </Text>
        <Text variant="heading2xl" as="p">
          {value}
        </Text>
        {subtitle && (
          <Text variant="bodySm" as="p" tone="subdued">
            {subtitle}
          </Text>
        )}
      </BlockStack>
    </Card>
  );
};

export default MetricCard;
