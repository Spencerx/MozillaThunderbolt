import { A } from '@solidjs/router'
import { ArrowLeft } from 'lucide-solid'
import { JSXElement } from 'solid-js'
import { Button } from './components/button'
import { Sidebar } from './components/sidebar'

export default function UiKitPage({ children }: { children?: JSXElement }) {
  return (
    <>
      <Sidebar>
        <div class="flex flex-col gap-4">
          <Button as={A} href="/" variant="outline">
            <ArrowLeft class="size-4" />
            Home
          </Button>
          <div class="flex flex-col gap-2">
            <Button as={A} href="/settings/accounts" variant="ghost" class="justify-start">
              Accounts
            </Button>
            <Button as={A} href="/settings/models" variant="ghost" class="justify-start">
              Models
            </Button>
          </div>
        </div>
      </Sidebar>
      <div class="flex flex-col gap-4 p-4 w-full">Hello</div>
    </>
  )
}
