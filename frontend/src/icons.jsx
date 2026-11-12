// Tabler Icons (Outline, Strich 1.75) mit den bisherigen Namen,
// damit die Komponenten nur den Import ändern müssen.
import {
  IconArchive, IconDownload, IconRefresh, IconLogout, IconUpload, IconBell, IconCalendarEvent, IconCalendarPlus,
  IconCalendar, IconChartBar, IconCircleCheck, IconCheck, IconChevronDown, IconChevronLeft,
  IconChevronRight, IconDatabase, IconClipboard, IconClipboardList, IconClock, IconSettings,
  IconFileText, IconDotsVertical, IconMail, IconAlertCircle, IconAlertTriangle, IconEye, IconEyeOff,
  IconHome, IconInfoCircle, IconLock, IconSearch, IconMapPin, IconPhone, IconCirclePlus, IconPlus,
  IconTrash, IconCar, IconUsers, IconUser, IconUserPlus, IconCircleX, IconX, IconCircleCheckFilled,
} from '@tabler/icons-react'

const wrap = (Cmp) => {
  const W = ({ className = '', ...props }) => <Cmp stroke={1.75} className={className} aria-hidden="true" {...props} />
  W.displayName = Cmp.displayName
  return W
}

export const ArchiveBoxIcon = wrap(IconArchive)
export const ArrowDownTrayIcon = wrap(IconDownload)
export const ArrowPathIcon = wrap(IconRefresh)
export const ArrowRightOnRectangleIcon = wrap(IconLogout)
export const ArrowUpTrayIcon = wrap(IconUpload)
export const BellIcon = wrap(IconBell)
export const CalendarDaysIcon = wrap(IconCalendarEvent)
export const CalendarIcon = wrap(IconCalendar)
export const CalendarPlusIcon = wrap(IconCalendarPlus)
export const ChartBarIcon = wrap(IconChartBar)
export const CheckCircleIcon = wrap(IconCircleCheck)
export const CheckCircleSolid = wrap(IconCircleCheckFilled)
export const CheckIcon = wrap(IconCheck)
export const ChevronDownIcon = wrap(IconChevronDown)
export const ChevronLeftIcon = wrap(IconChevronLeft)
export const ChevronRightIcon = wrap(IconChevronRight)
export const CircleStackIcon = wrap(IconDatabase)
export const ClipboardDocumentIcon = wrap(IconClipboard)
export const ClipboardDocumentListIcon = wrap(IconClipboardList)
export const ClockIcon = wrap(IconClock)
export const Cog6ToothIcon = wrap(IconSettings)
export const DocumentTextIcon = wrap(IconFileText)
export const FileText = wrap(IconFileText)
export const EllipsisVerticalIcon = wrap(IconDotsVertical)
export const EnvelopeIcon = wrap(IconMail)
export const ExclamationCircleIcon = wrap(IconAlertCircle)
export const ExclamationTriangleIcon = wrap(IconAlertTriangle)
export const EyeIcon = wrap(IconEye)
export const EyeSlashIcon = wrap(IconEyeOff)
export const HomeIcon = wrap(IconHome)
export const InformationCircleIcon = wrap(IconInfoCircle)
export const LockClosedIcon = wrap(IconLock)
export const MagnifyingGlassIcon = wrap(IconSearch)
export const MapPinIcon = wrap(IconMapPin)
export const PhoneIcon = wrap(IconPhone)
export const PlusCircleIcon = wrap(IconCirclePlus)
export const PlusIcon = wrap(IconPlus)
export const TrashIcon = wrap(IconTrash)
export const TruckIcon = wrap(IconCar)
export const UserGroupIcon = wrap(IconUsers)
export const UserIcon = wrap(IconUser)
export const UserPlusIcon = wrap(IconUserPlus)
export const XCircleIcon = wrap(IconCircleX)
export const XMarkIcon = wrap(IconX)
