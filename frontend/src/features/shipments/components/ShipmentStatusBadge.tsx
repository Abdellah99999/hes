import React from "react";
import { ShipmentStatus, ParcelStatus } from "../schemas/shipment.schema";
import { StatusBadge } from "../../../components/common/StatusBadge";

interface ShipmentStatusBadgeProps {
  status: ShipmentStatus;
  size?: "sm" | "md" | "lg";
}

export const ShipmentStatusBadge: React.FC<ShipmentStatusBadgeProps> = ({
  status,
  size = "md",
}) => {
  return <StatusBadge status={status} size={size} />;
};

export const ParcelStatusBadge: React.FC<{
  status: ParcelStatus;
  size?: "sm" | "md";
}> = ({ status, size = "sm" }) => {
  return <StatusBadge status={status} size={size} />;
};

export default ShipmentStatusBadge;
