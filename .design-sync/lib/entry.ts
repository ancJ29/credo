// The design sync's library entry: credo's gallery parts and the one provider they draw inside.
// Never imported by the app; the sync builds it (`build.sh`) and Claude Design renders from it.
export { ActionButton } from '../../ui/src/components/atoms/ActionButton';
export { BackLink } from '../../ui/src/components/atoms/BackLink';
export { DoorHeading } from '../../ui/src/components/atoms/DoorHeading';
export { FieldLabel } from '../../ui/src/components/atoms/FieldLabel';
export { LogoTile } from '../../ui/src/components/atoms/LogoTile';
export { MenuRow } from '../../ui/src/components/atoms/MenuRow';
export { StatusBadge } from '../../ui/src/components/atoms/StatusBadge';
export { Tag } from '../../ui/src/components/atoms/Tag';
export { ActionRow } from '../../ui/src/components/molecules/ActionRow';
export { BrandBand } from '../../ui/src/components/molecules/BrandBand';
export { CopyText } from '../../ui/src/components/molecules/CopyText';
export { DataTable } from '../../ui/src/components/molecules/DataTable';
export { DetailField } from '../../ui/src/components/molecules/DetailField';
export { FormMessage } from '../../ui/src/components/molecules/FormMessage';
export { SectionTitle } from '../../ui/src/components/molecules/SectionTitle';
export { TableScroll } from '../../ui/src/components/molecules/TableScroll';
export { DoorCard } from '../../ui/src/components/organisms/DoorCard';
export { DoorPage } from '../../ui/src/components/organisms/DoorPage';
export { PageHeader } from '../../ui/src/components/organisms/PageHeader';
export { PageState } from '../../ui/src/components/organisms/PageState';
export { Panel } from '../../ui/src/components/organisms/Panel';
export { SectionCard } from '../../ui/src/components/organisms/SectionCard';
export { CredoProvider } from './CredoProvider';

// Mantine's own parts, as the app's theme dresses them: the gallery's "Mantine, in the theme".
export {
  Anchor,
  Badge,
  Button,
  Checkbox,
  Divider,
  Group,
  PasswordInput,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';

// The app's icon set (Tabler), the ones its screens draw.
export {
  IconBuilding,
  IconChevronRight,
  IconKeyboard,
  IconLock,
  IconPencil,
  IconPlus,
  IconQrcode,
  IconSearch,
  IconSettings,
  IconTrash,
  IconUser,
  IconUsers,
} from '@tabler/icons-react';
