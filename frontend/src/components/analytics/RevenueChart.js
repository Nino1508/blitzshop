import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { Card, BlockStack, Text } from "@shopify/polaris";

const RevenueChart = ({ data = [], viewMode, formatPrice }) => {
  return (
    <Card>
      <BlockStack gap="200">
        {/* Corregido: quitamos as="h2" */}
        <Text variant="headingMd">
          {viewMode === "daily" ? "Daily Revenue" : "Monthly Revenue"}
        </Text>

        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey={viewMode === "daily" ? "date" : "month"}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickFormatter={formatPrice}
                width={80}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={formatPrice}
                labelFormatter={(label) =>
                  viewMode === "daily" ? `Date: ${label}` : `Month: ${label}`
                }
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#5c6ac4"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </BlockStack>
    </Card>
  );
};

export default RevenueChart;
