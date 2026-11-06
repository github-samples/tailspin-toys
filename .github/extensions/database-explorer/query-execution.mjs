export async function executeReadOnlyQuery(client, query) {
    await client.execute("PRAGMA query_only = ON");
    return client.execute(query);
}
