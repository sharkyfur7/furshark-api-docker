import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import type { Database } from "./supabase.types.js";

dotenv.config({ quiet: true });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL) {
  throw new Error("env var SUPABASE_URL is not set!");
}

if (!SUPABASE_KEY) {
  throw new Error("env var SUPABASE_KEY is not set!");
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY);

export async function insertNotification(text: string) {
  const { error } = await supabase.from("ntfy").insert({ text: text });

  if (error) {
    throw new Error(`${error.code} ${error.name} - ${error.message} (${error.hint}) // ${error.details}`);
  }
}

export async function getMessages() {
  // const ENTRIES_PER_PAGE = 8;
  // const START = page * ENTRIES_PER_PAGE;
  // const END = START + ENTRIES_PER_PAGE;

  const { data, error } = await supabase
    .from("messages")
    .select()
    .eq("visible", true)
    .is("reply_to", null)
    .order("created", { ascending: false })
    .select("id, created, name, content, site");

  if (error) {
    throw new Error(`${error.code} ${error.name} - ${error.message} (${error.hint}) // ${error.details}`);
  } else {
    return data;
  }
}

export async function getMessageReplies(id: number) {
  const { data, error } = await supabase
    .from("messages")
    .select()
    .eq("visible", true)
    .eq("reply_to", id)
    .order("created", { ascending: false });

  if (error) {
    throw new Error(`${error.code} ${error.name} - ${error.message} (${error.hint}) // ${error.details}`);
  } else {
    // the client does not need the visible column since it's always going to be true
    data.forEach((val) => {
      val.visible = undefined;
    });

    return data;
  }
}

export async function getMessageData() {
  let data = await getMessages();
  let response = {
    count: data.length,
    entries: data,
  };

  for (const message of response.entries) {
    let replies = await getMessageReplies(message.id);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    message.replies = replies;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    message.reply_count = replies.length;
  }

  return response;
}

export async function insertMessage(name: string, content: string, reply: number | null, site: string | null) {
  const { error } = await supabase
    .from("messages")
    .insert({ name: name, content: content, reply_to: reply, site: site });

  if (error) {
    throw new Error(`${error.code} ${error.name} - ${error.message} (${error.hint}) // ${error.details}`);
  }
}
