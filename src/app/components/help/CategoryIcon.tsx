import {
  IconArrowBackUp,
  IconBolt,
  IconBuildingStore,
  IconCash,
  IconDeviceMobile,
  IconFolder,
  IconPackage,
  IconRocket,
  IconTool,
  IconTruck,
  IconUser,
} from '@tabler/icons-react';
import type { KbCategory } from '../../models/kb';
import { cn } from '../../lib/utils';

// Explicit map (keeps tree-shaking working — no wildcard icon import). Falls back
// to a folder icon for any unmapped name.
const CATEGORY_ICONS: Record<string, typeof IconFolder> = {
  IconRocket,
  IconUser,
  IconTruck,
  IconBolt,
  IconCash,
  IconPackage,
  IconDeviceMobile,
  IconArrowBackUp,
  IconBuildingStore,
  IconTool,
};

/** Icon names an admin can pick from when not uploading a graphic. */
export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS);

export interface CategoryIconProps {
  category: Pick<KbCategory, 'name' | 'icon' | 'iconUrl'>;
  size?: number;
  className?: string;
}

/**
 * A category's graphic: an uploaded icon when one exists, otherwise the built-in
 * glyph, otherwise a folder. Uploads win so an admin can rebrand a category
 * without a code change — the built-in name stays as the fallback.
 */
export function CategoryIcon({ category, size = 22, className }: CategoryIconProps) {
  if (category.iconUrl) {
    return (
      <img
        src={category.iconUrl}
        alt=""
        aria-hidden="true"
        className={cn('object-contain', className)}
        style={{ width: size, height: size }}
      />
    );
  }

  const Icon = (category.icon && CATEGORY_ICONS[category.icon]) || IconFolder;
  return <Icon size={size} className={className} />;
}
