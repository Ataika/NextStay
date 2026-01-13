# UI Components

This directory contains reusable UI components that are part of the design system.

## Components

### Button
Unified button component with consistent styling.

**Variants:** `primary`, `secondary`, `danger`  
**Sizes:** `sm`, `md`, `lg`  
**Props:** `fullWidth`, `disabled`, standard button props

### Card
Consistent container component for content blocks.

**Padding:** `none`, `sm`, `md`, `lg`  
**Props:** `hover` (enables hover shadow effect)

### PageHeader
Standardized page header with title and optional subtitle.

**Props:** `title`, `subtitle`, `action` (optional React node)

### LoadingSpinner
Consistent loading state indicator.

**Props:** `message`, `fullScreen`

### ErrorState
Consistent error display with optional retry.

**Props:** `title`, `message`, `onRetry`, `retryLabel`, `fullScreen`

### EmptyState
Consistent empty state display.

**Props:** `title`, `message`, `icon`, `action`

### Modal
Universal modal dialog component.

**Props:**
- `isOpen` - boolean to control visibility
- `onClose` - function to close the modal
- `title` - modal title
- `children` - modal content
- `footer` - optional footer content (buttons, etc.)
- `size` - "sm" | "md" | "lg" | "xl" (default: "md")

**Features:**
- Closes on Escape key
- Closes on backdrop click
- Prevents body scroll when open
- Responsive sizing
- Dark mode support

**Usage:**
```tsx
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Modal Title"
  size="md"
  footer={<Button onClick={() => setIsOpen(false)}>Close</Button>}
>
  <p>Modal content</p>
</Modal>
```

## Usage

```tsx
import Button from "../ui/Button";
import Card from "../ui/Card";
import PageHeader from "../ui/PageHeader";
import Modal from "../ui/Modal";
```

## Design System

These components follow the design system defined in `../constants/designTokens.ts`:
- Consistent colors (primary, success, warning, danger, neutral)
- Standardized spacing and layout
- Dark mode support
- Responsive design
