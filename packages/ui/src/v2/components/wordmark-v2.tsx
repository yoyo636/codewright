import { createUniqueId, type ComponentProps } from "solid-js"

export function WordmarkV2(props: Pick<ComponentProps<"svg">, "class">) {
  const mask = createUniqueId()
  const maskGradient = createUniqueId()

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 588 84"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <g opacity="0.6">
        <g mask={`url(#${mask})`}>
          <g opacity="0.16">
            <path
              opacity="0.7"
              d="M36 60H12V36H36V60ZM48 72H0V12H48V72Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M96 60H72V36H96V60ZM108 72H72V84H60V12H108V72Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M168 48V60H132V48H168ZM168 48H132V60H168V72H120V12H168V48ZM132 36H156V24H132V36Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M216 72H192V36H216V72ZM216 24H192V72H180V12H216V24ZM228 72H216V24H228V72Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M288 60H252V36H288V60ZM288 24H252V60H288V72H240V12H288V24Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M336 60H312V36H336V60ZM336 24H312V60H336V24ZM348 72H300V12H348V72Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M396 60H372V36H396V60ZM396 24H372V60H396V24ZM408 72H360V12H396V0H408V72Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M468 48V60H432V48H468ZM432 24V36H456V24H432ZM468 48H432V60H468V72H420V12H468V48Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M516 60H504V36H516V60ZM540 60H528V36H540V60ZM540 48H504V36H540V48Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M540 72H480V12H540V72Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M588 48H552V36H588V48ZM576 72H564V36H576V72Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M588 72H540V12H588V72Z"
              fill="currentColor"
            />
          </g>
        </g>
      </g>
      <defs>
        <mask id={mask} style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="588" height="84">
          <rect width="588" height="84" fill={`url(#${maskGradient})`} />
        </mask>
        <linearGradient id={maskGradient} x1="294" y1="44" x2="294" y2="84" gradientUnits="userSpaceOnUse">
          <stop stop-color="white" stop-opacity="0.7" />
          <stop offset="1" stop-color="white" stop-opacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}
