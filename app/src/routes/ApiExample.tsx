import { useState } from "react";
import {
  Title,
  Text,
  Card,
  Button,
  TextInput,
  Group,
  Code,
  Stack,
  Alert,
  Table,
  Loader,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconHeartbeat,
  IconList,
  IconPlus,
  IconAlertCircle,
} from "@tabler/icons-react";
import { getItems, createItem, getHealthCheck } from "@/api/client";
import type { AxiosError } from "axios";

interface Item {
  id: string;
  name: string;
  description?: string;
}

function formatError(err: unknown): string {
  const axErr = err as AxiosError;
  if (axErr.response) {
    return `${axErr.response.status} – ${JSON.stringify(axErr.response.data)}`;
  }
  return axErr.message ?? String(err);
}

const ApiExample = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [healthStatus, setHealthStatus] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleHealthCheck = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await getHealthCheck();
      setHealthStatus(JSON.stringify(res.data, null, 2));
      notifications.show({
        title: "Health Check",
        message: "Backend responded successfully",
        color: "green",
      });
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleFetchItems = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await getItems();
      setItems(res.data);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateItem = async () => {
    if (!newName.trim()) return;
    setError("");
    setLoading(true);
    try {
      await createItem({ name: newName, description: newDesc || undefined });
      notifications.show({
        title: "Item Created",
        message: `"${newName}" created successfully`,
        color: "green",
      });
      setNewName("");
      setNewDesc("");
      await handleFetchItems();
    } catch (err) {
      setError(formatError(err));
      setLoading(false);
    }
  };

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>API Example</Title>
        <Text size="sm" c="dimmed" mt="xs">
          These calls go through the <Code>/_api</Code> proxy. In production,
          the Express server injects an OAuth Bearer token (client credentials
          flow) before forwarding to the backend. In development, the Vite
          plugin does the same. The browser never sees the token.
        </Text>
      </div>

      {error && (
        <Alert
          variant="light"
          color="red"
          icon={<IconAlertCircle size={16} />}
          withCloseButton
          onClose={() => setError("")}
        >
          {error}
        </Alert>
      )}

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group mb="md">
          <IconHeartbeat size={20} />
          <Text fw={500}>Health Check</Text>
          {loading && <Loader size="xs" />}
        </Group>
        <Button
          leftSection={<IconHeartbeat size={16} />}
          variant="light"
          onClick={handleHealthCheck}
          loading={loading}
        >
          GET /health
        </Button>
        {healthStatus && (
          <Code block mt="md">
            {healthStatus}
          </Code>
        )}
      </Card>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group mb="md">
          <IconList size={20} />
          <Text fw={500}>Fetch Items</Text>
        </Group>
        <Button
          leftSection={<IconList size={16} />}
          variant="light"
          onClick={handleFetchItems}
          loading={loading}
        >
          GET /items
        </Button>
        {items.length > 0 && (
          <Table mt="md" striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>ID</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>Description</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td>
                    <Code>{item.id}</Code>
                  </Table.Td>
                  <Table.Td fw={500}>{item.name}</Table.Td>
                  <Table.Td c="dimmed">{item.description ?? "—"}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group mb="md">
          <IconPlus size={20} />
          <Text fw={500}>Create Item</Text>
        </Group>
        <Group align="end">
          <TextInput
            label="Name"
            placeholder="Item name (required)"
            value={newName}
            onChange={(e) => setNewName(e.currentTarget.value)}
            required
            style={{ flex: 1 }}
          />
          <TextInput
            label="Description"
            placeholder="Optional description"
            value={newDesc}
            onChange={(e) => setNewDesc(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleCreateItem}
            loading={loading}
            disabled={!newName.trim()}
          >
            POST /items
          </Button>
        </Group>
      </Card>
    </Stack>
  );
};

export default ApiExample;
