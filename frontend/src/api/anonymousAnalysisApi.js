import apiClient from "./axios.js";
import { API_PATHS } from "../utils/constants.js";

const unwrap = (response) => response.data;

// Polling configuration
const POLL_INTERVAL_MS = 750;
const MAX_POLL_ATTEMPTS = 80; // ~60 seconds at 750ms intervals
const ACTIVE_STATUSES = new Set([
  "queued",
  "waiting",
  "processing",
  "active",
  "delayed",
  "prioritized",
]);

export const recordAnonymousConsent = ({
  agreedToTerms,
  agreedToPrivacy,
}) =>
  apiClient
    .post(
      API_PATHS.anonymousConsent,
      {
        agreedToTerms,
        agreedToPrivacy,
      },
      {
        withCredentials: true,
      }
    )
    .then(unwrap);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const analyzeAnonymously = async (profile, consentId) => {
  // Step 1: POST to queue the analysis
  const postResponse = await apiClient
    .post(
      API_PATHS.anonymousAnalysis,
      {
        profile,
        consentId,
      },
      {
        withCredentials: true,
      }
    )
    .then(unwrap);

  // Check if the response already contains a completed result
  if (postResponse?.data?.status === "completed") {
    console.log("[ANON FRONTEND] Analysis completed immediately");
    return {
      success: true,
      data: postResponse.data.result || postResponse.data,
    };
  }

  // Extract jobId from the queued response
  const jobId =
    postResponse?.data?.jobId ||
    postResponse?.jobId ||
    postResponse?.data?.id ||
    null;

  if (!jobId) {
    throw new Error("Analysis job ID was not returned. Please try again.");
  }

  console.log("[ANON FRONTEND] Job queued:", jobId);

  // Step 2: Poll until completed or failed
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    try {
      const statusResponse = await apiClient
        .get(`${API_PATHS.anonymousAnalysis}/${jobId}`, {
          withCredentials: true,
        })
        .then(unwrap);

      const statusData = statusResponse?.data ?? statusResponse;
      const status = statusData?.status;

      console.log("[ANON FRONTEND] Polling:", status);

      if (status === "completed") {
        console.log("[ANON FRONTEND] Analysis completed");
        
        const result = statusData?.result ?? statusData;
        const recommendations = result?.recommendations ?? [];
        
        console.log("[ANON FRONTEND] Recommendation count:", recommendations.length);
        
        return {
          success: true,
          data: {
            profile: result?.profile ?? profile,
            recommendations,
            consent: result?.consent ?? null,
          },
        };
      }

      if (status === "failed") {
        throw new Error(
          statusData?.message || "Your skin analysis failed. Please try again."
        );
      }

      // Continue polling for active statuses
      if (!ACTIVE_STATUSES.has(status) && status !== "not_found") {
        console.warn("[ANON FRONTEND] Unknown status:", status);
      }
      
      if (status === "not_found") {
        throw new Error("Analysis job was not found. Please try again.");
      }
    } catch (error) {
      // Re-throw API errors
      throw error;
    }
  }

  // Timeout
  throw new Error(
    "Your skin analysis is taking longer than expected. Please try again."
  );
};

export default {
  recordAnonymousConsent,
  analyzeAnonymously,
};