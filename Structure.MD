My goto tech stack will be:
Backend:
Node.js
Express
MongoDB
Redis

Core Functionalities:
1. Authentication
    - Email & OTP Based
    There will be 2 Roles student and mentor, this system is design currently for one mentor and their students. But the design of the DB and whole flow is to created for more mentors in future.

    Now I'm thinking of two tables, one for student information & other for mentor information.
    And one another table studentMentor for making a relation between them. This will help use in future to scale the system.

    For starting will create our first mentor and login credentials for the mentor.
    And student will be linked to that mentor on registering to the plaform.

    This is the Authentication flow in my mind.

    I want to use Redis for authentication and also authentication will be using crypto module not JWT and it will statefull and will aslo can be managed by the mentor.

    session limiting, A student can have only 2 sessions. He need to logout of previous device if want to login if session limit exceed.

2. Authorization
    - mentor permissions
        - create courses
        - update course content
        - admin panel access
        - give access to the student manually
        - revoke a student access
        - view all the recent comments
        - reply to comments
        - view all students enrollements
        - view all students profile
        - delete/ban a student
        - blacklist a email

    - student permissions
        - can access purchased content of the mentor
        - can watch the videos
        - can CRUD comment on the mentor videos
        - reply to comments

3. Core Functionalities
    
    - Create Course
        - All the information required for creating a course like:
            - thumbnail
            - title
            - slug
            - price
            - description
            - course curriculum
            - chapters informations
            - chapters videos + titles
            - chapter specific additional resources uploading
            - chapter videos uploading
            - chapter specific description
            - per video thumbnail upload (optional)

        - Course chapters and chapter videos should able to reorder and rearrange by dragging.

        - Update Course same flow
        - Delete course require OTP verification & course will be deleted only after 24 hours.
        - All the images/files will be stored in the cloudflare services which are cheaper than AWS

    - Course Enrollment
        - Every new user will first see the homepage suppose as birghtmango.in as the creator home page and marketing about their courses.
        - When the user clicks on a specific course he will be reidrected to a course detail page with some detail information about the course and a enrollement button
        - Once click on enrollment button he will be redirected to a checkout page, for onboarding and account creation.
        - Onboarding will based on email + otp:
            - (Account Creation) 2 Checks:
                - New User -> Create account and map to mentor
                - User Already exist:
                    - If not mapping with the mentor map it
            - (Course Buying) 2 Checks:
                - New Student(Not enrolled the course) ->  start the payment process
                - Old Student(Already enrolled the course) -> Show message & option to redirect to course page

        - After all validation clicking on `Proceed to Pay` will open a razorpay popup, after successful payment he will be redirected to the course page in the main app (app.brightmango.in)

    - I don't want user to login 10 times for course enrollment verification, once added email + otp will store it for the next 7 days

    
    - Video Player
        - Good Video player to give a better experience to the students with all the necessary keyboard shortcuts.
        - Auto Progess tracking based on the video duration for the video
        - Expected Features:
            - Modern video player
            - Keyboard shortcuts
            - Progress saving
            - Resume playback
            - Fullscreen support
            - Speed controls
            - Picture-in-picture
            - Subtitles
            - Quality selection
                
    - Comment
        - Student can comment on the courses video and can reply to the comments in a nested format.

    - Resources should be download able by the student and progress should be shown on UI.

    - Course Progess tracking
        - Overall Course progress should also be shown to the student.

    - Coupon Code
        - Mentor should able to create coupon code - course specific from the admin dashboard

    - Bulk Mail Notification feature:
        - Mentor should able to send email to all the students at once from the admin dashboard by using dynamic fields like adding name, progess, etc

    - Manually can add student to a course without payment with the help of email, when student login with the mail he will get the course. Also notify the student on that mail.

    - Student should able to see a tab of "Recently Watched Lessons"


- Security Criteria

Think carefully about:
- Authentication
- Authorization
- Payment verification
- API protection
- Input validation
- Access control
- Content protection

Let's plan the DB models for this and how it will be done from authentication to course progess saving.
