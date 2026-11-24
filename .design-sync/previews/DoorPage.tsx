import { Button, DoorCard, DoorHeading, DoorPage, IconUser, Stack, TextInput } from 'credo-design-system';

const page = (languages?: boolean) => (
  <div style={{ ['--door-page-height' as string]: '460px' }}>
    <DoorPage
      languages={languages ? [{ language: 'vi', name: 'Tiếng Việt' }, { language: 'en', name: 'English' }] : undefined}
      onLanguage={languages ? () => undefined : undefined}
    >
      <DoorCard name="Credo">
        <Stack gap="md">
          <DoorHeading title="Sign in" />
          <TextInput label="Username" leftSection={<IconUser size={18} />} />
          <Button variant="gradient" size="md" fullWidth>
            Sign in
          </Button>
        </Stack>
      </DoorCard>
    </DoorPage>
  </div>
);

export const Plain = () => page();
export const WithLanguageSwitch = () => page(true);
