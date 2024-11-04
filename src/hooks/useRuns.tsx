export function useRuns() {
  /**
   * Generates a public shared run ID for the given run ID.
   */
  const shareRun = async (runId: string): Promise<string | undefined> => {
    console.log("Starting run sharing process for runId:", runId);
    const res = await fetch("/api/runs/share", {
      method: "POST",
      body: JSON.stringify({ runId }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.error("Failed to share run for runId:", runId);
      return;
    }

    const { sharedRunURL } = await res.json();
    console.log("Run sharing process completed successfully for runId:", runId);
    return sharedRunURL;
  };

  return {
    shareRun,
  };
}
