import {
  PERMISSIONS,
  type PermissionId,
  type PermissionLayer,
  resolvePermissions,
} from '@credo/shared';
import { Badge, Checkbox, Group, SegmentedControl, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { PERMISSION_LABEL } from './permissionLabels';

type Props = {
  layer: PermissionLayer;
  onChange: (layer: PermissionLayer) => void;
  /** `allow`: a department stores what it allows (the setup page drops an unchecked one when it
   * saves, whatever it was loaded or edited as). `each`: a position or a person may also refuse,
   * and what they leave alone follows the level above. */
  mode: 'allow' | 'each';
  /** The layers beneath this one, to say what leaving a permission alone gives. */
  below?: readonly PermissionLayer[];
  /** Names the controls apart where several editors stand on a page. */
  label: string;
};

const withValue = (layer: PermissionLayer, id: PermissionId, value: boolean | undefined) => {
  const { [id]: _was, ...rest } = layer;
  return value === undefined ? rest : { ...rest, [id]: value };
};

/** The catalogue, in its order, as a set of choices: the one editor a department, a position and
 * a person all use. */
export function PermissionEditor({ layer, onChange, mode, below, label }: Props) {
  const { t } = useTranslation();
  const inherited = below ? resolvePermissions(below) : null;
  return (
    <Stack gap="xs" role="group" aria-label={label}>
      {PERMISSIONS.map((id) =>
        mode === 'allow' ? (
          <Checkbox
            key={id}
            label={t(PERMISSION_LABEL[id])}
            checked={layer[id] === true}
            onChange={(event) => onChange(withValue(layer, id, event.currentTarget.checked))}
          />
        ) : (
          <Group key={id} justify="space-between" wrap="wrap">
            <div>
              <Text size="sm">{t(PERMISSION_LABEL[id])}</Text>
              {inherited && (
                <Text size="xs" c="dimmed">
                  {t('permissions.inherit')}:{' '}
                  {t(inherited[id] ? 'permissions.allowed' : 'permissions.refused')}
                </Text>
              )}
            </div>
            <Group gap="xs">
              {layer[id] !== undefined && <Badge variant="light">{t('permissions.custom')}</Badge>}
              <SegmentedControl
                size="xs"
                aria-label={`${label}: ${t(PERMISSION_LABEL[id])}`}
                value={layer[id] === undefined ? 'inherit' : layer[id] ? 'allow' : 'refuse'}
                onChange={(value) =>
                  onChange(
                    withValue(layer, id, value === 'inherit' ? undefined : value === 'allow'),
                  )
                }
                data={[
                  { value: 'inherit', label: t('permissions.inherit') },
                  { value: 'allow', label: t('permissions.allow') },
                  { value: 'refuse', label: t('permissions.refuse') },
                ]}
              />
            </Group>
          </Group>
        ),
      )}
    </Stack>
  );
}
