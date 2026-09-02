import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Title,
  Text,
  Card,
  Badge,
  Group,
  Code,
  Loader,
  Stack,
  Alert,
  Anchor,
} from "@mantine/core";
import { IconHeartbeat, IconInfoCircle, IconSettings } from "@tabler/icons-react";
import { getHealthCheck } from "@/api/client";

const Home = () => {
  const [status, setStatus] = useState<"loading" | "connected" | "error">(
    "loading",
  );
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    getHealthCheck()
      .then(() => setStatus("connected"))
      .catch((err) => {
        setStatus("error");
        setErrorMsg(err.message);
      });
  }, []);

  const runtimeEnv = window.__env__;

  return (
    <Stack gap="lg">
      <Title order={2}>Home</Title>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group mb="xs">
          <IconHeartbeat size={20} />
          <Text fw={500}>Backend Connection</Text>
          {status === "loading" && <Loader size="xs" />}
          {status === "connected" && (
            <Badge color="green" variant="light">
              Connected
            </Badge>
          )}
          {status === "error" && (
            <Badge color="orange" variant="light">
              Unreachable
            </Badge>
          )}
        </Group>

        {status === "connected" && (
          <Text size="sm" c="dimmed">
            Backend is reachable via the <Code>/_api</Code> proxy.
          </Text>
        )}

        {status === "error" && (
          <Alert
            variant="light"
            color="orange"
            icon={<IconInfoCircle size={16} />}
            mt="xs"
          >
            <Text size="sm">
              Backend not reachable — this is normal if no backend is running.
            </Text>
            {errorMsg && (
              <Code block mt="xs">
                {errorMsg}
              </Code>
            )}
          </Alert>
        )}

        <Text size="sm" mt="md">
          See the{" "}
          <Anchor component={Link} to="/api-example">
            API Example
          </Anchor>{" "}
          page for GET / POST demonstrations with the OAuth-protected proxy.
        </Text>
      </Card>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group mb="xs">
          <IconSettings size={20} />
          <Text fw={500}>Runtime Environment</Text>
          <Code>window.__env__</Code>
        </Group>

        {runtimeEnv && Object.keys(runtimeEnv).length > 0 ? (
          <Code block>{JSON.stringify(runtimeEnv, null, 2)}</Code>
        ) : (
          <Text size="sm" c="dimmed">
            No <Code>VITE_*</Code> runtime variables injected. In Docker, the
            entrypoint writes <Code>env-config.js</Code> from{" "}
            <Code>VITE_*</Code> environment variables.
          </Text>
        )}
      </Card>
    </Stack>
  );
};

export default Home;
