import { createOpenAI } from '@ai-sdk/openai'
import { Message, useChat } from '@ai-sdk/react'
import { fetch as rawTauriFetch } from '@tauri-apps/plugin-http'
import { streamText, tool, ToolInvocation } from 'ai'
import { z } from 'zod'

export type ToolInvocationWithResult<T = object> = ToolInvocation & {
  result: T
}

const p2 = `
  You are a helpful executive assistant that assists users generating passwords. Create a password for the user and reply to them.
  `

const tauriFetch = async (url: RequestInfo | URL, options: RequestInit) => {
  console.log('tauriFetch', url, options)
  return rawTauriFetch(url, options)
}

const debugFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  console.log('fetch', input, init)

  const options = init as RequestInit & { body: string }
  const body = JSON.parse(options.body)

  try {
    // Make a direct request to Ollama using Tauri's fetch
    const response = await tauriFetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3.2',
        messages: body.messages,
        stream: true,
      }),
    })

    console.log('Response status:', response.status)
    console.log('Response body:', response.body)

    // Return the raw response stream
    return new Response(response.body, {
      headers: response.headers,
      status: response.status,
    })
  } catch (error) {
    console.log('Error details:', error)
    console.error('Error calling Ollama:', error)
    throw error
  }
}

const ollama = createOpenAI({
  // baseURL: 'http://localhost:11434/v1',

  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    console.log('tauri fetch', input, init)
    return tauriFetch(input, init)
  },
  // compatibility: 'compatible',
  apiKey: 'ollama',
})

const openai = createOpenAI({
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    console.log('tauri fetch', input, init)
    return tauriFetch(input, init)
  },
  // apiKey: 'api key',
})

const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  console.log('fetch', input, init)

  const options = init as RequestInit & { body: string }
  const body = JSON.parse(options.body)

  const { messages } = body as { messages: Message[] }

  const processedMessages = messages.map((message) => ({
    ...message,
    parts: message.parts?.map((part) => {
      if (part.type === 'tool-invocation' && !(part.toolInvocation as ToolInvocationWithResult).result) {
        return {
          ...part,
          toolInvocation: {
            ...part.toolInvocation,
            result: true,
          },
        }
      }
      return part
    }),
  }))

  const result = streamText({
    maxSteps: 5,
    // model: fireworks('accounts/fireworks/models/llama-v3p1-405b-instruct'),
    // model: fireworks('accounts/fireworks/models/deepseek-r1'),
    model: openai('gpt-4o', {
      structuredOutputs: true,
    }),
    system: p2,
    messages: processedMessages,
    toolCallStreaming: true, // Causes issues because this results in incomplete result objects getting passed to React components. Experimentation to block rendering until the full objects are available is needed.
    tools: {
      search: tool({
        description: "A tool for searching the user's inbox.",
        parameters: z.object({
          query: z.string().describe("The query to search the user's inbox with."),
          originalUserMessage: z.string().describe('The original user message that triggered this tool call.'),
        }),
        execute: async ({ query, originalUserMessage }) => {
          // @todo
          return 'No results found.'
        },
      }),
      answer: tool({
        description: 'Provide your final response to the user.',
        parameters: z.object({
          text: z.string().describe('The verbal response to the user. Do not list anything here.'),
          results: z.array(z.string()),
        }),
        // Important: Do NOT have an execute function otherwise it will call this tool multiple times.
        // But: it is helpful for debugging :)
        // execute: async ({ text, results }) => {
        //   console.log('answer', text, results)
        // },
      }),
    },
    onFinish: async () => {
      // console.log('done', result.reasoning, result.finishReason, result.warnings, result.text, result.toolResults)
    },
    toolChoice: 'required',
  })

  return result.toDataStreamResponse()
}

export default function App() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    fetch,
    maxSteps: 5,
    // streamProtocol: 'text',
  })

  console.log('messages', messages)

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((message, i) => (
          <div key={message.id} className={`message ${message.role}`}>
            {message.parts
              .filter((part) => part.type === 'tool-invocation')
              .map((part) => {
                const { toolName, toolCallId, args } = part.toolInvocation
                return (
                  <div key={toolCallId}>
                    <div>{toolName}</div>
                    <div>
                      {JSON.stringify(args)} {args?.text}
                    </div>
                  </div>
                )
              })}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} placeholder="Say something..." />
        <button type="submit">Send</button>
      </form>
    </div>
  )
}
