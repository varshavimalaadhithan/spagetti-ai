import "server-only";
import OpenAI from "openai";

let client: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (client) {
    return client;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured."
    );
  }

  client = new OpenAI({
    apiKey,
  });

  return client;
}

export const openai = new Proxy(
  {} as OpenAI,
  {
    get(_target, property) {
      const instance = getOpenAI();

      const value = Reflect.get(
        instance,
        property
      );

      return typeof value === "function"
        ? value.bind(instance)
        : value;
    },
  }
);