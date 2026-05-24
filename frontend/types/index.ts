export type UserRole = "customer" | "admin";
export type OrderStatus = "received" | "printing" | "dispatched" | "delivered";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type PrintFileStatus = "pending" | "generating" | "ready" | "failed";
export type SiteTheme = "classic" | "blush" | "midnight";

export interface SlotPosition {
  slot_id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: "rect" | "circle" | "free";
  label?: string | null;
  points?: Array<{ x: number; y: number }> | null;
}

export type TextFontGroup = "name" | "numbers" | "details" | "general";
export type TextWeight = "normal" | "bold";
export type TextAlign = "left" | "center" | "right";

export interface TextPosition {
  text_id: number;
  label: string;
  placeholder?: string | null;
  default_text?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  font_group: TextFontGroup;
  font_family: string;
  font_weight: TextWeight;
  font_size: number;
  color: string;
  align: TextAlign;
  allow_customer_font?: boolean;
}

export interface FrameTemplate {
  id: string;
  name: string;
  slug: string;
  category: string;
  size: string;
  slot_count: number;
  price: string;
  offer_price: string | null;
  is_active: boolean;
  frame_asset_url: string;
  slot_positions: SlotPosition[];
  text_positions: TextPosition[];
  created_at: string;
}

export interface SlotAdjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  rotation: number;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
  flipX: boolean;
  flipY: boolean;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
}

export interface CustomizationSlot {
  slot_id: number;
  image_url: string;
  adjustments: SlotAdjustments;
}

export interface CustomizationText {
  text_id: number;
  value: string;
  font_family?: string;
  font_weight?: TextWeight;
}

export interface CustomizationData {
  frame_id: string;
  slots: CustomizationSlot[];
  texts?: CustomizationText[];
  composite_preview_url?: string;
  composite_export_meta?: {
    pixel_ratio: number;
    width: number;
    height: number;
  };
}

export interface CartItemPayload {
  frame_id: string;
  quantity: number;
  price: number;
  customization_data: CustomizationData;
}

export interface LocalCartItem {
  id: string;
  frame: FrameTemplate;
  quantity: number;
  price: number;
  customization: CustomizationData;
}

export interface EditorSlotState {
  slot_id: number;
  image_url: string;
  adjustments: SlotAdjustments;
}

export interface EditorTextState {
  text_id: number;
  value: string;
  font_family?: string;
  font_weight?: TextWeight;
}

export interface OrderItem {
  id: string;
  order_id: string;
  frame_id: string;
  customization_data: CustomizationData;
  print_file_status: PrintFileStatus;
  print_file_error?: string | null;
  quantity: number;
  price: string;
  frame?: FrameTemplate | null;
}

export interface OrderRecord {
  id: string;
  user_id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  total_amount: string;
  delivery_address: Record<string, string>;
  tracking_link: string | null;
  created_at: string;
  items: OrderItem[];
  user?: AuthProfile | null;
}

export interface AuthProfile {
  id: string;
  supabase_uid: string;
  email: string;
  name: string | null;
  role: UserRole;
  created_at: string;
}

export interface AdminDashboardSummary {
  total_users: number;
  total_frames: number;
  total_orders: number;
  printing_orders: number;
  revenue: string;
}

export interface SiteSettings {
  active_theme: SiteTheme;
  updated_at?: string | null;
}
