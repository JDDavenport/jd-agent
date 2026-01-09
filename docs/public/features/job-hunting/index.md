---
title: Job Hunting Agent
description: AI-powered job search automation with intelligent matching, application tracking, and browser automation
---

# Job Hunting Agent

The Job Hunting Agent is a sophisticated AI-powered assistant that automates and streamlines your job search process. It eliminates the administrative overhead of job hunting, letting you focus on what matters—preparing for interviews and evaluating opportunities.

## Overview

The Job Hunting Agent integrates seamlessly with the JD Agent ecosystem, providing:

- **Intelligent Job Discovery** with match scoring based on your preferences
- **Application Automation** including resume selection and cover letter generation
- **Pipeline Tracking** through the entire job search lifecycle
- **Browser Automation** for direct applications on job boards
- **Interview Management** with follow-up scheduling

## Getting Started

### Set Up Your Profile

Before the agent can help, you need to configure your job search preferences:

```
"Set my target titles to Senior Software Engineer and Staff Engineer.
I'm looking for remote positions with a minimum salary of $180k.
Exclude consulting companies from my search."
```

The agent will update your profile with:
- Target job titles
- Preferred and excluded companies
- Salary requirements
- Location preferences (remote, hybrid, onsite)
- Required skills and experience level

### Upload Your Resumes

The agent supports multiple resume variants optimized for different roles:

- **Engineering** - Technical accomplishments focused
- **Product** - Product impact and collaboration
- **Leadership** - Management and team building
- **General** - Balanced for broad applications

Upload variants through the API or frontend, and the agent will automatically select the best match for each application.

## Core Features

### Job Discovery

The agent can search across multiple platforms and score jobs against your profile:

```
"Search for Senior Engineer positions in San Francisco"
"Find remote React positions with a match score above 80"
```

**Match Scoring Algorithm:**
| Factor | Weight | Description |
|--------|--------|-------------|
| Title Match | 25% | How closely the title matches your targets |
| Company Match | 20% | Bonus for target companies, penalty for excluded |
| Salary Match | 20% | Whether compensation meets your minimum |
| Location Match | 15% | Remote preference or preferred locations |
| Skills Match | 20% | Overlap between your skills and requirements |

### Application Tracking

Track every job through a complete pipeline:

```
discovered → saved → applying → applied → phone_screen → interviewing → offered → accepted
                                                                        ↘ rejected
                                                                        ↘ withdrawn
```

The agent automatically logs:
- Status changes with timestamps
- Notes and observations
- Interview schedules
- Contact information

### Cover Letter Generation

Generate tailored cover letters with different tones:

```
"Generate a cover letter for the Google position with an enthusiastic tone"
```

Available tones:
- **Professional** (default)
- **Enthusiastic**
- **Conversational**
- **Formal**

### Screening Answers

Build a library of answers for common screening questions:

```
"Save this answer for work authorization questions:
I am authorized to work in the United States without sponsorship."
```

Categories tracked:
- Work authorization
- Salary expectations
- Availability
- Experience questions
- Relocation
- Other

The agent matches incoming questions to your saved answers automatically.

## Available Tools

The Job Hunting Agent has **31 tools** organized by function:

### Discovery Tools
| Tool | Description |
|------|-------------|
| `job_search` | Search for jobs with filters (query, location, platform, min score) |
| `job_analyze` | Deep analysis of job postings with fit assessment |
| `job_calculate_match` | Detailed match score breakdown |
| `job_get_profile` | Retrieve your search preferences |
| `job_update_profile` | Update your preferences |

### Application Tools
| Tool | Description |
|------|-------------|
| `job_select_resume` | Auto-select best resume for a specific job |
| `job_generate_cover_letter` | Generate tailored cover letter |
| `job_answer_screening` | Answer screening questions (save for reuse) |
| `job_mark_applied` | Record application submission |

### Tracking Tools
| Tool | Description |
|------|-------------|
| `job_list` | List jobs with filters |
| `job_get` | Get detailed job info |
| `job_update_status` | Update job status |
| `job_add_note` | Add timestamped notes |
| `job_schedule_followup` | Set follow-up reminders |
| `job_add_interview` | Log interview details |
| `job_add_contact` | Add recruiter/hiring manager info |
| `job_archive` | Archive job to vault |
| `job_get_followups` | List pending follow-ups |

### Resume Management
| Tool | Description |
|------|-------------|
| `resume_list` | List all resume variants |
| `resume_get` | Get resume details |
| `resume_set_default` | Set default resume |

### Browser Automation
| Tool | Description |
|------|-------------|
| `browser_login` | Login to job boards (LinkedIn, MBA Exchange) |
| `browser_search_jobs` | Search jobs via browser automation |
| `browser_apply` | Automated job application |
| `browser_get_job_details` | Scrape job posting details |

## Supported Platforms

### LinkedIn
- Easy Apply automation
- Job search with filters
- Session persistence (7-day cookies)
- Security challenge handling

### MBA Exchange
- Login and search
- Application form filling

### Manual Entry
Track applications made outside the system with full history.

## Interview Tracking

Log interviews with full context:

```
"Log a video interview for the Amazon position on Friday at 2pm
with Jane Smith, Senior Engineering Manager"
```

Interview types:
- Phone screen
- Video interview
- Onsite
- Technical
- Behavioral
- Panel
- Final round

Track outcomes as: pending, passed, failed, or cancelled.

## Statistics & Reporting

Get insights into your job search progress:

```
"Show me my job search stats"
```

The agent provides:
- Total applications
- Applications this week
- Interviews scheduled
- Response rate
- Interview rate
- Pipeline health by status

## Vault Integration

Archive completed job searches to the Knowledge Vault for long-term storage:

```
"Archive the rejected jobs from last month to my vault"
```

All details are preserved:
- Application history
- Interview notes
- Contact information
- Timeline of events

## API Endpoints

The Job Hunting Agent exposes a REST API:

| Endpoint | Description |
|----------|-------------|
| `POST /api/jobs/chat` | Send message to the agent |
| `GET /api/jobs` | List jobs with filters |
| `GET /api/jobs/stats` | Dashboard statistics |
| `GET /api/jobs/follow-ups` | Pending follow-ups |
| `GET /api/jobs/profile` | Your preferences |
| `GET /api/jobs/resumes` | List resumes |
| `GET /api/jobs/screening` | Screening answer library |

## Configuration

Required environment variables:

```bash
OPENAI_API_KEY           # Required for agent functionality

# Optional: Browser automation
LINKEDIN_EMAIL           # LinkedIn login
LINKEDIN_PASSWORD        # LinkedIn password
MBAEXCHANGE_EMAIL        # MBA Exchange login
MBAEXCHANGE_PASSWORD     # MBA Exchange password

# Optional: Data storage
JOB_AGENT_DATA_DIR       # Data directory (default: /tmp/jd-agent-jobs)
JOB_AGENT_HEADLESS       # Browser headless mode (default: true)
```

## Best Practices

1. **Keep your profile updated** - The match scoring is only as good as your preferences
2. **Build your screening answer library** - Save time on repetitive questions
3. **Upload multiple resume variants** - Let the agent select the best fit
4. **Use follow-up reminders** - Never miss a follow-up opportunity
5. **Archive completed searches** - Build a searchable history in your vault

## Next Steps

- [Configure your profile](/docs/features/job-hunting/profile)
- [Upload your resumes](/docs/features/job-hunting/resumes)
- [Set up browser automation](/docs/features/job-hunting/automation)
