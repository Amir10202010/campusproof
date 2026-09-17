"use client";

import { useEffect, useReducer } from "react";
import {
  buildStreamUrl,
  fetchSavedProfile,
  initialProfileStreamState,
  profileStreamReducer,
  STREAM_EVENT_TYPES,
  TERMINAL_EVENT_TYPES,
  type ProfileStreamState,
} from "@/lib/client/profileStream";
import type { StreamEvent } from "@/lib/types";

export interface ProfileStreamParams {
  query?: string;
  qid?: string;
  refresh?: boolean;
  simulate?: string;
  /** dev/preview only: replay fixtures/stream.sample.ts instead of running the pipeline */
  replay?: boolean;
}

/**
 * Opens the profile stream and reduces events into ProfileStreamState. Owner: P1.
 * Closes the EventSource on every terminal event — otherwise the browser auto-reconnects and
 * re-runs the paid pipeline.
 */
export function useProfileStream(params: ProfileStreamParams | null): ProfileStreamState {
  const [state, dispatch] = useReducer(profileStreamReducer, initialProfileStreamState);
  const key = params ? JSON.stringify(params) : null;

  useEffect(() => {
    if (!key) return;
    const current = JSON.parse(key) as ProfileStreamParams;
    const source = new EventSource(buildStreamUrl(current));
    let finished = false;
    let unmounted = false;
    let qid = current.qid;
    dispatch({ type: "start", startedAt: Date.now(), query: current.query });

    const onMessage = (message: MessageEvent<string>) => {
      const event = JSON.parse(message.data) as StreamEvent;
      if (event.type === "resolved") qid = event.entity.qid;
      dispatch({ type: "event", event, now: Date.now() });
      if (TERMINAL_EVENT_TYPES.includes(event.type)) {
        finished = true;
        source.close();
      }
    };
    for (const type of STREAM_EVENT_TYPES) source.addEventListener(type, onMessage as EventListener);

    source.onerror = () => {
      if (finished) return;
      finished = true;
      source.close();
      const streamFailed = () =>
        dispatch({
          type: "event",
          event: {
            type: "error",
            code: "stream_failed",
            message: "Соединение прервалось. Попробуйте ещё раз.",
            retryable: true,
          },
          now: Date.now(),
        });
      // The stream broke mid-way: show the saved profile if the server has one (labeled as cached).
      if (!qid || current.replay) return streamFailed();
      void fetchSavedProfile(qid).then((profile) => {
        if (unmounted) return;
        if (profile) dispatch({ type: "event", event: { type: "done", profile, cached: true }, now: Date.now() });
        else streamFailed();
      });
    };

    return () => {
      finished = true;
      unmounted = true;
      source.close();
    };
  }, [key]);

  return state;
}
