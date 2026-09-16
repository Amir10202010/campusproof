"use client";

import { useEffect, useReducer } from "react";
import {
  buildStreamUrl,
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
    dispatch({ type: "start", startedAt: Date.now(), query: current.query });

    const onMessage = (message: MessageEvent<string>) => {
      const event = JSON.parse(message.data) as StreamEvent;
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
    };

    return () => {
      finished = true;
      source.close();
    };
  }, [key]);

  return state;
}
