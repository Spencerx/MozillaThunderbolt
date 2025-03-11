import { useChat } from '@ai-sdk/solid'
import { A } from '@solidjs/router'
import { Settings } from 'lucide-solid'
import { Button } from './components/button'
import ChatUI from './components/chat/ChatUI'
import { useSettings } from './components/settings'
import { Sidebar } from './components/sidebar'
import { aiFetchStreamingResponse } from './lib/ai'

export default function Home() {
  const { settings } = useSettings()

  const chatHelpers = useChat({
    fetch: (requestInfoOrUrl, init) => aiFetchStreamingResponse(settings.models?.openai_api_key, requestInfoOrUrl, init),
    maxSteps: 5,
  })

  // console.log('messages', chatHelpers.messages())

  return (
    <>
      <Sidebar>
        <div class="flex flex-col gap-4">
          <Button as={A} href="/settings/accounts" variant="outline">
            <Settings class="size-4" />
            Settings
          </Button>
          <div class="flex flex-col gap-2">
            <Button as={A} href="/ui-kit" variant="ghost" class="justify-start">
              UI Kit
            </Button>
          </div>
        </div>
      </Sidebar>
      <div class="h-full w-full">
        <ChatUI chatHelpers={chatHelpers} />
      </div>
    </>
  )
}
